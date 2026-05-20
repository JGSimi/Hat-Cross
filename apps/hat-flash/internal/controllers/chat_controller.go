package controllers

import (
	"context"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"
)

type ChatController struct {
	chat *services.ChatService
}

func NewChatController(chat *services.ChatService) *ChatController {
	return &ChatController{chat: chat}
}

func (c *ChatController) Stream(request models.ChatStreamRequest) error {
	return c.chat.Stream(context.Background(), request)
}

func (c *ChatController) Cancel(streamID int64) {
	c.chat.Cancel(streamID)
}
