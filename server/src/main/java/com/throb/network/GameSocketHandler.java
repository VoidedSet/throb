package com.throb.network;

import com.throb.game.RoomManager;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

public class GameSocketHandler extends TextWebSocketHandler {

    private final RoomManager roomManager = RoomManager.getInstance();
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        session.sendMessage(new TextMessage("{\"type\": \"SERVER_HELLO\", \"id\": \"" + session.getId() + "\"}"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode node = mapper.readTree(message.getPayload());
        if (!node.has("type"))
            return;

        String type = node.get("type").asString();

        if ("JOIN".equals(type)) {
            String roomId = node.has("roomCode") ? node.get("roomCode").asString() : "DEFAULT";
            roomManager.handleJoin(roomId, session);
        } else {
            roomManager.handleMessage(session, message.getPayload());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        roomManager.handleDisconnect(session);
    }
}