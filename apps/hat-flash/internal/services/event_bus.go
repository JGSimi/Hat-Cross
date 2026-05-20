package services

import "sync"

type EventBus interface {
	Emit(name string, data ...any) bool
}

type EventHub struct {
	mu     sync.RWMutex
	target EventBus
}

func NewEventHub() *EventHub {
	return &EventHub{}
}

func (h *EventHub) SetTarget(target EventBus) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.target = target
}

func (h *EventHub) Emit(name string, data ...any) bool {
	h.mu.RLock()
	target := h.target
	h.mu.RUnlock()
	if target == nil {
		return false
	}
	return target.Emit(name, data...)
}

type MemoryEventBus struct {
	Events []MemoryEvent
}

type MemoryEvent struct {
	Name string
	Data []any
}

func (b *MemoryEventBus) Emit(name string, data ...any) bool {
	b.Events = append(b.Events, MemoryEvent{Name: name, Data: data})
	return true
}
