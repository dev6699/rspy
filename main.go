package main

import (
	"bytes"
	"embed"
	"encoding/base64"
	"encoding/json"
	"image/png"
	"io"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/go-vgo/robotgo"
	"github.com/gorilla/websocket"
	"github.com/kbinani/screenshot"
)

var (
	connected = false
	drag      = false
	lock      sync.Mutex
)

//go:embed all:view
var content embed.FS

func main() {
	setupRoutes()
	log.Println("⚠️ CAUTION USE AT YOUR OWN RISK!!! ⚠️")
	log.Println("Server listening on http://0.0.0.0:8888")
	log.Fatal(http.ListenAndServe("0.0.0.0:8888", nil))
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

				img, _ := screenshot.CaptureRect(bounds)
				buffer := new(bytes.Buffer)
				png.Encode(buffer, img)
				encoded := base64.StdEncoding.EncodeToString(buffer.Bytes())

				err := conn.WriteMessage(messageType, []byte(encoded))
				if err != nil {
					log.Println(err)
					break L
				}
			}
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

	if drag {
		robotgo.DragSmooth(m.X, m.Y)
	} else {
		robotgo.MoveMouse(m.X, m.Y)
	}

	if m.Click.Click {
		robotgo.MouseClick(m.Click.Side, false)
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

	if len(keys) == 2 && keys[0] == "*" && keys[1] == "ctrl" {
		drag = !drag
	}

	lock.Lock()
	robotgo.KeyTap(keys[0], keys)
	lock.Unlock()
}
