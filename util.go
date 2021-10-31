package main

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"strconv"
)

func responseModifier(response *http.Response, modify func([]byte) []byte) error {
	data, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return err
	}
	err = response.Body.Close()
	if err != nil {
		return err
	}
	data = modify(data)
	response.Header.Set("Content-Length", strconv.Itoa(len(data)))
	response.Body = io.NopCloser(bytes.NewReader(data))
	return nil
}
