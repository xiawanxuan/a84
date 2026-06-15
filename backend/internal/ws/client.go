package ws

import (
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"

	zaplogger "forest-pointcloud-annotation/pkg/logger"
)

type Client struct {
	ID        string
	UserID    string
	Username  string
	Color     string
	DatasetID string
	Hub       *Hub
	Conn      *websocket.Conn
	send      chan []byte
}

func NewClient(hub *Hub, conn *websocket.Conn, userID, username, color string) *Client {
	return &Client{
		ID:       userID + "-" + time.Now().Format("20060102150405"),
		UserID:   userID,
		Username: username,
		Color:    color,
		Hub:      hub,
		Conn:     conn,
		send:     make(chan []byte, 256),
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				zaplogger.Sugar.Errorf("websocket read error: %v", err)
			}
			break
		}

		var msg ClientMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			zaplogger.Sugar.Errorf("unmarshal client message failed: %v", err)
			continue
		}

		c.handleMessage(&msg)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg *ClientMessage) {
	switch msg.Type {
	case "join-dataset":
		if datasetID, ok := msg.Payload.(string); ok {
			c.Hub.JoinDataset(datasetID, c)
		} else if m, ok := msg.Payload.(map[string]interface{}); ok {
			if dsID, exists := m["dataset_id"]; exists {
				c.Hub.JoinDataset(dsID.(string), c)
			}
		}

	case "leave-dataset":
		if c.DatasetID != "" {
			c.Hub.LeaveDataset(c.DatasetID, c)
		}

	case "annotation-create", "annotation-update", "annotation-delete":
		if c.DatasetID != "" {
			c.Hub.Broadcast(&BroadcastMessage{
				DatasetID: c.DatasetID,
				UserID:    c.UserID,
				Type:      msg.Type,
				Payload:   msg.Payload,
				ExcludeID: c.ID,
			})
		}

	case "cursor-update", "selection-update":
		if c.DatasetID != "" {
			payload := msg.Payload
			if m, ok := payload.(map[string]interface{}); ok {
				m["user_id"] = c.UserID
				payload = m
			}
			c.Hub.Broadcast(&BroadcastMessage{
				DatasetID: c.DatasetID,
				UserID:    c.UserID,
				Type:      msg.Type,
				Payload:   payload,
				ExcludeID: c.ID,
			})
		}

	case "heartbeat":
		c.Hub.SendToClient(c.ID, "heartbeat", nil)
	}
}
