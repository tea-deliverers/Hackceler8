package main

import (
	"bufio"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
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
					forbiddenNames.ReplaceAllString(challengeID, "-"),
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
	l    net.Listener
	conn net.Conn
	cond *sync.Cond
}

func newLocalTerminal() (*localTerminal, error) {
	l, err := net.Listen("tcp", terminalListen)
	if err != nil {
		return nil, err
	}
	term := &localTerminal{l: l, cond: sync.NewCond(&sync.Mutex{})}
	go term.accept()
	return term, nil
}

func (l *localTerminal) accept() {
	for {
		conn, err := l.l.Accept()
		if err != nil {
			log.Print(err)
			break
		}
		l.cond.L.Lock()
		l.conn = conn
		l.cond.Broadcast()
		l.cond.L.Unlock()
	}
}

func (l *localTerminal) Read(p []byte) (int, error) {
	l.cond.L.Lock()
	for l.conn == nil {
		l.cond.Wait()
	}
	conn := l.conn
	l.cond.L.Unlock()
	n, err := conn.Read(p)
	if err != nil {
		l.conn = nil
	}
	return n, err
}

func (l *localTerminal) Write(p []byte) (int, error) {
	l.cond.L.Lock()
	defer l.cond.L.Unlock()
	if l.conn == nil {
		return 0, errors.New("no remote")
	}
	n, err := l.conn.Write(p)
	if err != nil {
		l.conn = nil
	}
	return n, err
}

func (l *localTerminal) Close() error {
	l.cond.L.Lock()
	defer l.cond.L.Unlock()
	if l.conn != nil {
		l.conn.Close()
		l.conn = nil
	}
	return l.l.Close()
}

func aux(writer http.ResponseWriter, request *http.Request) {
	terminal, err := newLocalTerminal()
	if err != nil {
		log.Print("terminal: ", err)
		return
	}
	defer terminal.Close()

	client, err := upgrader.Upgrade(writer, request, nil)
	if err != nil {
		log.Print("aux: ", err)
		return
	}
	defer client.Close()

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
				log.Println("write terminal: ", err)
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
			if scanner.Err() != nil {
				log.Println("read local: ", scanner.Err())
			}
		}
	}()

	<-ctx.Done()
}
