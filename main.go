package main

import (
	"bytes"
	"embed"
	"encoding/base64"
	"encoding/json"
	"flag"
	"image/jpeg"
	"io"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-vgo/robotgo"
	"github.com/gorilla/websocket"
	"github.com/kbinani/screenshot"
)

var (
	connected = false
	lock      sync.Mutex
	interval  time.Duration
	quality   int
)

//go:embed all:view
var content embed.FS

func main() {
	f := parseFlags()
	quality = f.Quality
	if quality < 1 || quality > 100 {
		log.Fatal("Invalid quality option: ", quality)
	}
	d, err := time.ParseDuration(f.Interval)
	if err != nil {
		log.Fatal(err)
	}
	interval = d
	log.Println("Quality:", quality)
	log.Println("Interval:", interval)
	setupRoutes()
	log.Println("⚠️ CAUTION USE AT YOUR OWN RISK!!! ⚠️")
	log.Println("Server listening on http://0.0.0.0:8888")
	log.Fatal(http.ListenAndServe("0.0.0.0:8888", nil))
}

type Flags struct {
	Quality  int
	Interval string
}

func parseFlags() Flags {
	var f Flags
	flag.IntVar(&f.Quality, "q", 80, "Quality of screenshot, ranges from 1 to 100 inclusive, higher is better")
	flag.StringVar(&f.Interval, "i", "100ms", "Interval between screenshot capture. Examples: [100ms, 1s, 1m, 1h]")
	flag.Parse()
	return f
}

func setupRoutes() {
	assets, _ := fs.Sub(content, "view")
	http.Handle("/", http.FileServer(http.FS(assets)))
	http.HandleFunc("/ws", handleWS)
	http.HandleFunc("/mouse", handleMouse)
	http.HandleFunc("/scroll", handleScroll)
	http.HandleFunc("/type", handleType)
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	if connected {
		log.Println("Only 1 session is allowed.")
		return
	}

	upgrade := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	ws, err := upgrade.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	updateScreen(ws)
}

func updateScreen(conn *websocket.Conn) {
	connected = true
	for {
		messageType, _, err := conn.ReadMessage()
		if err != nil {
			log.Println(err, conn.Close())
			break
		}

		n := screenshot.NumActiveDisplays()
	L:
		for {
			for i := 0; i < n; i++ {
				bounds := screenshot.GetDisplayBounds(i)

				img, err := screenshot.CaptureRect(bounds)
				if err != nil {
					// err when screen locked
					log.Println(err)
					continue
				}
				buffer := new(bytes.Buffer)
				opt := jpeg.Options{
					Quality: quality,
				}

				jpeg.Encode(buffer, img, &opt)
				encoded := base64.StdEncoding.EncodeToString(buffer.Bytes())

				err = conn.WriteMessage(messageType, []byte(encoded))
				if err != nil {
					log.Println(err)
					break L
				}
			}
			time.Sleep(interval)
		}
	}
	connected = false
}

func handleScroll(w http.ResponseWriter, r *http.Request) {

	type scroll struct {
		Direction string `json:"direction"`
		Rate      int    `json:"rate"`
	}
	var s scroll
	b, err := io.ReadAll(r.Body)
	if err != nil {
		log.Println(err)
		return
	}

	err = json.Unmarshal([]byte(b), &s)
	if err != nil {
		log.Println(err)
		return
	}

	lock.Lock()
	robotgo.ScrollDir(s.Rate, s.Direction)
	lock.Unlock()
}

func handleMouse(w http.ResponseWriter, r *http.Request) {
	type clickAtrributes struct {
		Click bool   `json:"click"`
		Side  string `json:"side"`
		Drag  bool   `json:"drag"`
	}

	type mouse struct {
		X     int             `json:"x"`
		Y     int             `json:"y"`
		Click clickAtrributes `json:"clickAttr"`
	}
	var m mouse
	b, err := io.ReadAll(r.Body)
	if err != nil {
		log.Println(err)
		return
	}

	err = json.Unmarshal([]byte(b), &m)
	if err != nil {
		log.Println(err)
		return
	}

	lock.Lock()

	if m.Click.Drag {
		robotgo.DragSmooth(m.X, m.Y)
	} else {
		robotgo.MoveMouse(m.X, m.Y)
		if m.Click.Click {
			robotgo.Click(m.Click.Side)
		}
	}

	lock.Unlock()
}

func handleType(w http.ResponseWriter, r *http.Request) {
	type text struct {
		Text string `json:"word"`
	}

	var t text
	b, err := io.ReadAll(r.Body)
	if err != nil {
		log.Println(err)
		return
	}

	err = json.Unmarshal([]byte(b), &t)
	if err != nil {
		log.Println(err)
		return
	}

	keys := strings.Split(t.Text, "|")
	lock.Lock()
	robotgo.KeyTap(keys[0], keys)
	lock.Unlock()
}
