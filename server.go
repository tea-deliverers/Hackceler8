package main

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"

	"github.com/gorilla/websocket"
)

func recvServer(client, server *websocket.Conn) {
	for {
		mt, message, err := server.ReadMessage()
		if err != nil {
			log.Println("read server:", err)
			return
		}

		var s ServerMsg
		err = json.Unmarshal(message, &s)
		if err != nil {
			log.Println("decode server:", err)
			return
		}
		switch s.Type {
		case "terminal":
			fmt.Printf("Challenge ID: %s\n", s.ChallengeID)
			switch s.EventType {
			case "data":
				data, err := hex.DecodeString(s.Data)
				if err != nil {
					log.Println(err)
					return
				}
				fmt.Println(hex.Dump(data))
			}
		}

		err = client.WriteMessage(mt, message)
		if err != nil {
			log.Println("write client:", err)
			return
		}
	}
}

type ServerMsg struct {
	Type        string `json:"type"`
	ChallengeID string `json:"challengeID"`
	EventType   string `json:"eventType"`
	Data        string `json:"data"`
}
