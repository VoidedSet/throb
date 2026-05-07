package com.throb.network;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.concurrent.CopyOnWriteArrayList;

public class GameSocketHandler extends TextWebSocketHandler {
    private static final CopyOnWriteArrayList<WebSocketSession> sessions = new CopyOnWriteArrayList<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        System.out.println("Player connected w session id: " + session.getId());

        session.sendMessage(
                new TextMessage("{\\\"type\\\": \\\"SERVER_HELLO\\\", \\\"msg\\\": \\\"Welcome to Throb!\\\"}\""));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        System.out.println("recieved from " + session.getId() + ": " + payload);

        // testing echo to all connections
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage("{\\\"type\\\": \\\"ECHO\\\", \\\"data\\\": \" + payload + \"}"));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
        System.out.println("Player w session id " + session.getId() + " disconnected :(");
    }
}
