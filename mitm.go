package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

const (
	gameServer  = "http://localhost:4567"
	terminalListen = "localhost:2333"
	gameServerAuthUsername = ""
	gameServerAuthPassword = ""
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

func basicAuth(username, password string) string {
	auth := username + ":" + password
	return base64.StdEncoding.EncodeToString([]byte(auth))
}

func wsMitm(writer http.ResponseWriter, request *http.Request) {
	var serverHeader http.Header
	if gameServerAuthUsername != "" {
		serverHeader = make(http.Header)
		serverHeader.Add("Authorization", "Basic " + basicAuth(gameServerAuthUsername, gameServerAuthPassword))
	}
	server, _, err := websocket.DefaultDialer.Dial("ws"+gameServer[4:], serverHeader)
	if err != nil {
		log.Print("server:", err)
		return
	}
	defer server.Close()

	client, err := upgrader.Upgrade(writer, request, nil)
	if err != nil {
		log.Print("client:", err)
		return
	}
	defer client.Close()

	ctx, cancel := context.WithCancel(request.Context())

	go func() {
		defer cancel()
		for {
			mt, message, err := client.ReadMessage()
			if err != nil {
				log.Println("read client:", err)
				return
			}
			//log.Printf("recv client: %s", message)

			err = server.WriteMessage(mt, message)
			if err != nil {
				log.Println("write server:", err)
				return
			}
		}
	}()

	go func() {
		defer cancel()
		recvServer(client, server)
	}()

	go func() {
		ticker := time.NewTicker(time.Second * 15)
		defer ticker.Stop()
		for _ = range ticker.C {
			deadline := time.Now().Add(time.Second * 5)
			err := client.WriteControl(websocket.PingMessage, nil, deadline)
			if err != nil {
				log.Println("ping client:", err)
				return
			}
		}
	}()

	<-ctx.Done()
}

func main() {
	gameServerUri, _ := url.ParseRequestURI(gameServer)
	proxy := httputil.NewSingleHostReverseProxy(gameServerUri)
	oldDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		oldDirector(request)
		if (gameServerAuthUsername != "") {
			request.SetBasicAuth(gameServerAuthUsername, gameServerAuthPassword)
		}
	}
	proxy.ModifyResponse = func(response *http.Response) (err error) {
		switch response.Request.URL.Path {
		case "/main.js":
			err = responseModifier(response, func(data []byte) []byte {
				return bytes.Replace(data, []byte("const RES_"), []byte("let RES_"), 2)
			})
		case "/visuals.js":
			err = responseModifier(response, func(data []byte) []byte {
				data = bytes.Replace(data,
					[]byte(`(globals.state.state.entities.player.x - (RES_W/2))`),
					[]byte(`this.viewportX`),
					1)
				data = bytes.Replace(data,
					[]byte(`(globals.state.state.entities.player.y - (RES_H/2))`),
					[]byte(`this.viewportY`),
					1)
				return data
			})
		case "/":
			err = responseModifier(response, func(data []byte) []byte {
				index := bytes.Index(data, []byte("</head>"))
				if index < 0 {
					return data
				}
				var buf bytes.Buffer
				buf.Write(data[:index])
				buf.WriteString(`<script src="/hack.js"></script><link rel="stylesheet" href="/hack.css">`)
				buf.Write(data[index:])
				return buf.Bytes()
			})
		}
		return
	}

	log.Fatal(http.ListenAndServe("localhost:12450",
		http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if len(request.Header.Values("Upgrade")) > 0 {
				if request.URL.Path == "/aux" {
					aux(writer, request)
				} else {
					wsMitm(writer, request)
				}
				return
			}
			switch request.URL.Path {
			case "/hack.js":
				http.ServeFile(writer, request, "hack.js")
			case "/hack.css":
				http.ServeFile(writer, request, "hack.css")
			default:
				proxy.ServeHTTP(writer, request)
			}
		})),
	)
}
