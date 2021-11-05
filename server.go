package main

import (
	"bufio"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sync"
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

type localTerminal struct {
	conn     net.Conn
	readCond *sync.Cond
}

func newLocalTerminal() *localTerminal {
	return &localTerminal{readCond: &sync.Cond{L: &sync.Mutex{}}}
}

func (l *localTerminal) connect() (err error) {
	l.conn, err = net.Dial("tcp", localServer)
	return
}

func (l *localTerminal) Read(p []byte) (int, error) {
	l.readCond.L.Lock()
	for l.conn == nil {
		l.readCond.Wait()
	}
	l.readCond.L.Unlock()
	return l.conn.Read(p)
}

func (l *localTerminal) Write(p []byte) (int, error) {
	l.readCond.L.Lock()
	if l.conn == nil {
		err := l.connect()
		if err != nil {
			l.readCond.L.Unlock()
			return 0, err
		}
		l.readCond.Broadcast()
	}
	l.readCond.L.Unlock()
	return l.conn.Write(p)
}

func (l *localTerminal) Close() error {
	l.readCond.L.Lock()
	err := l.conn.Close()
	l.conn = nil
	l.readCond.L.Unlock()
	return err
}

func aux(writer http.ResponseWriter, request *http.Request) {
	client, err := upgrader.Upgrade(writer, request, nil)
	if err != nil {
		log.Print("aux: ", err)
		return
	}
	defer client.Close()

	terminal := newLocalTerminal()

	ctx, cancel := context.WithCancel(request.Context())
	go func() {
		defer cancel()
		for {
			_, message, err := client.ReadMessage()
			if err != nil {
				log.Println("read client:", err)
				return
			}
			//log.Printf("recv client: %s", message)'

			_, err = terminal.Write(append(message, '\n'))
			if err != nil {
				log.Println("write local:", err)
			}
		}
	}()

	go func() {
		defer cancel()
		for {
			scanner := bufio.NewScanner(terminal)
			for scanner.Scan() {
				err := client.WriteMessage(websocket.TextMessage, scanner.Bytes())
				if err != nil {
					log.Println("write client:", err)
					return
				}
			}
			terminal.Close()
			if scanner.Err() != nil {
				log.Println("read local:", scanner.Err())
			}
		}
	}()

	<-ctx.Done()
}
