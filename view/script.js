(() => {
  const socket = new WebSocket("ws://" + window.location.host + "/ws");
  socket.onopen = () => {
    console.log("Successfully Connected");
    socket.send("Hi From the Client!");
  };

  socket.onmessage = function (evt) {
    document.querySelector("#screen").src = "data:image/png;base64," + evt.data;
  };

  socket.onclose = (event) => {
    console.log("Socket Closed Connection: ", event);
    socket.send("Client Closed!");
  };

  socket.onerror = (error) => {
    console.log("Socket Error: ", error);
  };

  let x, y

  document.addEventListener('keydown', (event) => {
    event.preventDefault()

    let key = event.key
    if (key === 'CapsLock') {
      // backend will crash
      return
    }

    if (key.length !== 1 || !(key >= 'A' && key <= 'Z')) {
      key = key.toLowerCase()
    }

    switch (key) {
      case 'arrowleft':
        key = 'left'
        break
      case 'arrowright':
        key = 'right'
        break
      case 'arrowup':
        key = 'up'
        break
      case 'arrowdown':
        key = 'down'
        break
    }

    if (key === 'meta') {
      key = 'command'
    } else {
      if (event.shiftKey) {
        key += "|shift"
      }

      if (event.altKey) {
        key += "|alt"
      }

      if (event.ctrlKey) {
        key += "|ctrl"
      }
    }

    if (key === '*|ctrl') {
      const textEl = document.querySelector('#text')
      if (textEl.innerHTML) {
        textEl.innerHTML = ''
      } else {
        textEl.innerHTML = 'DRAGGING'
      }
    }

    fetch(window.location.href + "type", {
      method: "POST",
      body: JSON.stringify({
        word: key,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    })
  })

  function debounce(func, delay) {
    let timeoutId;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(function () {
        func.apply(context, args);
      }, delay);
    };
  }

  function sendMouse(x, y) {
    fetch(window.location.href + "mouse", {
      method: "POST",
      body: JSON.stringify({ x, y }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const scrollOpt = {
    direction: '',
    rate: 0
  }

  function sendScroll(_scrollOpt) {
    fetch(window.location.href + "scroll", {
      method: "POST",
      body: JSON.stringify({ ..._scrollOpt, rate: Math.floor(_scrollOpt.rate) }),
      headers: {
        "Content-Type": "application/json",
      },
    }).then(() => {
      scrollOpt.rate = 0
    })
  }

  const debouncedScroll = debounce(sendScroll, 50);
  const debouncedSendMouse = debounce(sendMouse, 50);

  document.addEventListener('wheel', function (event) {
    let rate = event.deltaY
    let direction = event.deltaY > 0 ? 'down' : 'up';
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      direction = event.deltaX > 0 ? 'right' : 'left'
      rate = event.deltaX
    }

    rate = Math.min(Math.abs(rate), 5)
    if (scrollOpt.direction === direction) {
      scrollOpt.rate += rate
    } else {
      scrollOpt.direction = direction
      scrollOpt.rate = rate
    }
    debouncedScroll(scrollOpt)
  });

  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      fetch(window.location.href + "mouse", {
        method: "POST",
        body: JSON.stringify({ x, y, clickAttr: { click: true, side: "left" } }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  })

  document.addEventListener("mousemove", function (event) {
    const img = document.querySelector("#screen");
    const offSetX = (window.innerWidth - img.width) / 2
    const offSetY = (window.innerHeight - img.height) / 2
    const pX = event.clientX
    const pY = event.clientY

    const widthRatio = img.naturalWidth / img.width
    const heightRatio = img.naturalHeight / img.height
    const toX = Math.floor((pX - offSetX) * widthRatio)
    const toY = Math.floor((pY - offSetY) * heightRatio)

    if (toX <= 0 || toX >= img.naturalWidth || toY <= 0 || toY >= img.naturalHeight) {
      return
    }
    x = toX
    y = toY

    debouncedSendMouse(x, y)
  });

})()
