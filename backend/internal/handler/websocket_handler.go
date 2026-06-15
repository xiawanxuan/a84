package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"forest-pointcloud-annotation/internal/ws"
	zaplogger "forest-pointcloud-annotation/pkg/logger"
)

type WebSocketHandler struct {
	hub *ws.Hub
}

func NewWebSocketHandler(hub *ws.Hub) *WebSocketHandler {
	return &WebSocketHandler{hub: hub}
}

func (h *WebSocketHandler) HandleConnection(c *gin.Context) {
	userID := c.GetString("user_id")
	username := c.GetString("username")
	color := c.DefaultQuery("color", "#4A90D9")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	conn, err := ws.Upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		zaplogger.Sugar.Errorf("websocket upgrade failed: %v", err)
		return
	}

	client := ws.NewClient(h.hub, conn, userID, username, color)
	h.hub.Register(client)

	h.hub.SendToClient(client.ID, "auth-success", map[string]interface{}{
		"user_id":  userID,
		"username": username,
	})

	go client.WritePump()
	go client.ReadPump()
}
