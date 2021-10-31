package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

const gameServer = "ws://localhost:4567"

var upgrader = websocket.Upgrader{
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

func mitm(writer http.ResponseWriter, request *http.Request) {
	server, _, err := websocket.DefaultDialer.Dial(gameServer, nil)
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

	var sg sync.WaitGroup
	sg.Add(2)

	go func() {
		defer sg.Done()
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
		defer sg.Done()
		recvServer(client, server)
	}()

	sg.Wait()
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
	http.HandleFunc("/", mitm)
	http.HandleFunc("/aux", aux)
	log.Fatal(http.ListenAndServe("localhost:12450", nil))
}
