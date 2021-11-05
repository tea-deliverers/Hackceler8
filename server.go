package main

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/gorilla/websocket"
)

var forbiddenNames = regexp.MustCompile(`[/\\<>:"|?*]`)

const (
	challDir = `./chall`
	mapDir   = `./map`
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

		typ, err := s.getString("type")
		if err != nil {
			log.Println("decode server:", err)
			return
		}

		switch typ {
		case "map":
			err := ioutil.WriteFile(
				filepath.Join(mapDir, fmt.Sprintf("%d.json", time.Now().UnixNano())),
				s["map"], 0777,
			)
			if err != nil {
				log.Println("write map file:", err)
			}
		case "terminal":
			challengeID, err := s.getString("challengeID")
			if err != nil {
				log.Println("decode server:", err)
				return
			}

			fmt.Printf("Challenge ID: %s\n", challengeID)

			eventType, err := s.getString("eventType")
			if err != nil {
				log.Println("decode server:", err)
				return
			}

			switch eventType {
			case "data":
				encoded, err := s.getString("data")
				if err != nil {
					log.Println("decode server:", err)
					return
				}
				data, err := hex.DecodeString(encoded)
				if err != nil {
					log.Println(err)
					return
				}
				saveChal := filepath.Join(challDir, fmt.Sprintf("%s-%d.json",
					forbiddenNames.ReplaceAllString(challengeID, "-")+".json",
					time.Now().UnixNano()))
				err = os.WriteFile(saveChal, data, 0777)
				if err != nil {
					log.Println("write chall file:", err)
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

type ServerMsg map[string]json.RawMessage

func (s ServerMsg) getString(key string) (str string, err error) {
	err = json.Unmarshal(s[key], &str)
	return
}
