package main

import (
	"bytes"
	"context"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gorilla/websocket"
)

const gameServer = "http://localhost:4567"

var upgrader = websocket.Upgrader{
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

func wsMitm(writer http.ResponseWriter, request *http.Request) {
	server, _, err := websocket.DefaultDialer.Dial("ws"+gameServer[4:], nil)
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

	<-ctx.Done()
}

func aux(writer http.ResponseWriter, request *http.Request) {
	client, err := upgrader.Upgrade(writer, request, nil)
	if err != nil {
		log.Print("aux: ", err)
		return
	}
	defer client.Close()
}

func main() {
	gameServerUri, _ := url.ParseRequestURI(gameServer)
	proxy := httputil.NewSingleHostReverseProxy(gameServerUri)
	proxy.ModifyResponse = func(response *http.Response) (err error) {
		switch response.Request.URL.Path {
		case "/main.js":
			err = responseModifier(response, func(data []byte) []byte {
				return bytes.Replace(data, []byte("const RES_"), []byte("let RES_"), 2)
			})
		case "/":
			err = responseModifier(response, func(data []byte) []byte {
				index := bytes.Index(data, []byte("</head>"))
				if index < 0 {
					return data
				}
				var buf bytes.Buffer
				buf.Write(data[:index])
				buf.WriteString(`<script src="/hack.js"></script>`)
				buf.Write(data[index:])
				return buf.Bytes()
			})
		}
		return
	}

	log.Fatal(http.ListenAndServe("localhost:12450",
		http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if len(request.Header.Values("Upgrade")) > 0 {
				wsMitm(writer, request)
				return
			}
			switch request.URL.Path {
			case "/hack.js":
				http.ServeFile(writer, request, "hack.js")
			default:
				proxy.ServeHTTP(writer, request)
			}
		})),
	)
}
