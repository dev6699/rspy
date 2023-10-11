(() => {
  const socket = new WebSocket("ws://" + window.location.host + "/ws");
  socket.onopen = () => {
    console.log("Successfully Connected");
    socket.send("Hi From the Client!");
  };

  const screenCap = new Image();
  let screenCapWidth
  let screenCapHeight

  // Wait for the DOM content to be fully loaded
  document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.querySelector("#screen");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");

    console.log(window.innerWidth, window.innerHeight)
    function handleResize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", handleResize);

    let imageLoaded = false;
    screenCap.onload = function () {
      imageLoaded = true;
    };

    socket.onmessage = function (evt) {
      screenCap.src = "data:image/png;base64," + evt.data;
    };

    // Animation function using requestAnimationFrame
    function animate() {
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw the image if it's loaded
      if (imageLoaded) {

        // Calculate position to draw the image
        let posX = 0;
        let posY = 0;

        // Calculate new width and height to fit the canvas while maintaining aspect ratio
        const aspectRatio = screenCap.width / screenCap.height;
        screenCapWidth = canvas.width;
        screenCapHeight = canvas.width / aspectRatio;

        // Check if the calculated height exceeds the canvas height, if so, resize based on height
        if (screenCapHeight > canvas.height) {
          screenCapHeight = canvas.height;
          screenCapWidth = canvas.height * aspectRatio;
        }

        // If the image is smaller than the canvas, center it
        if (screenCapWidth < canvas.width) {
          posX = (canvas.width - screenCapWidth) / 2;
        }
        if (screenCapHeight < canvas.height) {
          posY = (canvas.height - screenCapHeight) / 2;
        }

        // Draw the image
        ctx.drawImage(screenCap, posX, posY, screenCapWidth, screenCapHeight);
      }

      // Request animation frame for continuous rendering
      requestAnimationFrame(animate);
    }

    // Start the animation loop
    animate();
  });

  socket.onclose = (event) => {
    console.log("Socket Closed Connection: ", event);
    socket.send("Client Closed!");
  };

  socket.onerror = (error) => {
    console.log("Socket Error: ", error);
  };

  let mouseX, mouseY

  document.addEventListener("contextmenu", function (event) {
    // Prevent the default right-click menu behavior
    event.preventDefault();
  });

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

  function sendMouseMove(x, y) {
    fetch(window.location.href + "mouse", {
      method: "POST",
      body: JSON.stringify({ x: Math.floor(x), y: Math.floor(y) }),
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
  const debouncedSendMouseMove = debounce(sendMouseMove, 50);

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


  let isMouseDown = false
  let hasDrag = false

  document.addEventListener("mousedown", function (event) {
    isMouseDown = true
  })

  document.addEventListener('mouseup', (event) => {

    let side = ''
    switch (event.button) {
      case 0:
        side = "left"
        break
      case 1:
        side = "center"
        break
      case 2:
        side = "right"
        break
      case 3:
        side = "wheelDown"
        break
      case 4:
        side = "wheelUp"
        break
      case 5:
        side = "wheelLeft"
        break
      case 6:
        side = "wheelRight"
        break
    }

    fetch(window.location.href + "mouse", {
      method: "POST",
      body: JSON.stringify({ x: Math.floor(mouseX), y: Math.floor(mouseY), clickAttr: { click: true, side, drag: hasDrag } }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    isMouseDown = false
    hasDrag = false
  })

  document.addEventListener("mousemove", function (event) {
    if (isMouseDown) {
      hasDrag = true
    }

    const offSetX = (window.innerWidth - screenCapWidth) / 2
    const offSetY = (window.innerHeight - screenCapHeight) / 2
    const pX = event.clientX
    const pY = event.clientY

    const widthRatio = screenCap.naturalWidth / screenCapWidth
    const heightRatio = screenCap.naturalHeight / screenCapHeight
    const toX = Math.floor((pX - offSetX) * widthRatio)
    const toY = Math.floor((pY - offSetY) * heightRatio)

    if (toX <= 0 || toX >= screenCap.naturalWidth || toY <= 0 || toY >= screenCap.naturalHeight) {
      return
    }
    mouseX = toX
    mouseY = toY
    debouncedSendMouseMove(mouseX, mouseY)
  });
})()
