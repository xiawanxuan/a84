package ws

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	zaplogger "forest-pointcloud-annotation/pkg/logger"
)

type Hub struct {
	mu           sync.RWMutex
	clients      map[string]*Client
	datasetRooms map[string]map[string]*Client
	register     chan *Client
	unregister   chan *Client
	broadcast    chan *BroadcastMessage
}

type BroadcastMessage struct {
	DatasetID string
	UserID    string
	Type      string
	Payload   interface{}
	ExcludeID string
}

type ClientMessage struct {
	Type      string      `json:"type"`
	Timestamp int64       `json:"timestamp"`
	RequestID string      `json:"request_id,omitempty"`
	Payload   interface{} `json:"payload,omitempty"`
}

type UserPresence struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Color    string `json:"color"`
}

func NewHub() *Hub {
	return &Hub{
		clients:      make(map[string]*Client),
		datasetRooms: make(map[string]map[string]*Client),
		register:     make(chan *Client),
		unregister:   make(chan *Client),
		broadcast:    make(chan *BroadcastMessage, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			zaplogger.Sugar.Infof("client registered: %s", client.ID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				for datasetID, clients := range h.datasetRooms {
					if _, exists := clients[client.ID]; exists {
						delete(clients, client.ID)
						h.notifyRoomLeave(datasetID, client)
					}
				}
				close(client.send)
			}
			h.mu.Unlock()
			zaplogger.Sugar.Infof("client unregistered: %s", client.ID)

		case msg := <-h.broadcast:
			h.mu.RLock()
			if room, ok := h.datasetRooms[msg.DatasetID]; ok {
				data, err := json.Marshal(ClientMessage{
					Type:      msg.Type,
					Timestamp: time.Now().UnixMilli(),
					Payload:   msg.Payload,
				})
				if err != nil {
					zaplogger.Sugar.Errorf("marshal broadcast message failed: %v", err)
					h.mu.RUnlock()
					continue
				}

				for _, client := range room {
					if client.ID == msg.ExcludeID {
						continue
					}
					select {
					case client.send <- data:
					default:
						go func(c *Client) {
							h.unregister <- c
						}(client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) Broadcast(msg *BroadcastMessage) {
	h.broadcast <- msg
}

func (h *Hub) JoinDataset(datasetID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.datasetRooms[datasetID]; !ok {
		h.datasetRooms[datasetID] = make(map[string]*Client)
	}
	h.datasetRooms[datasetID][client.ID] = client
	client.DatasetID = datasetID

	zaplogger.Sugar.Infof("client %s joined dataset %s", client.ID, datasetID)
}

func (h *Hub) LeaveDataset(datasetID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.datasetRooms[datasetID]; ok {
		delete(room, client.ID)
		if len(room) == 0 {
			delete(h.datasetRooms, datasetID)
		}
	}
	client.DatasetID = ""
}

func (h *Hub) GetOnlineUsers(datasetID string) []UserPresence {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var users []UserPresence
	if room, ok := h.datasetRooms[datasetID]; ok {
		for _, client := range room {
			users = append(users, UserPresence{
				UserID:   client.UserID,
				Username: client.Username,
				Color:    client.Color,
			})
		}
	}
	return users
}

func (h *Hub) notifyRoomLeave(datasetID string, client *Client) {
	data, _ := json.Marshal(ClientMessage{
		Type:      "user-left",
		Timestamp: time.Now().UnixMilli(),
		Payload: map[string]string{
			"user_id": client.UserID,
		},
	})

	if room, ok := h.datasetRooms[datasetID]; ok {
		for _, c := range room {
			select {
			case c.send <- data:
			default:
			}
		}
	}
}

func (h *Hub) SendToClient(clientID string, msgType string, payload interface{}) error {
	h.mu.RLock()
	client, ok := h.clients[clientID]
	h.mu.RUnlock()

	if !ok {
		return nil
	}

	data, err := json.Marshal(ClientMessage{
		Type:      msgType,
		Timestamp: time.Now().UnixMilli(),
		Payload:   payload,
	})
	if err != nil {
		return err
	}

	select {
	case client.send <- data:
	default:
	}

	return nil
}

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

var Upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}
