package com.throb.game;

import java.util.concurrent.ConcurrentHashMap;

import org.springframework.web.socket.WebSocketSession;

import com.throb.model.Player;

public class RoomManager {
    private static final RoomManager instance = new RoomManager();
    private final ConcurrentHashMap<String, Room> rooms = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> sessionToRoomMap = new ConcurrentHashMap<>();

    private RoomManager() {
    }

    public static RoomManager getInstance() {
        return instance;
    }

    public void handleJoin(String roomId, WebSocketSession session) {
        rooms.putIfAbsent(roomId, new Room(roomId));
        Room room = rooms.get(roomId);

        Player player = new Player(session.getId(), session);
        room.players.put(session.getId(), player);
        sessionToRoomMap.put(session.getId(), roomId);

        if (room.players.size() == 1)
            room.start(); // this start doesnt start the game it initiates the room ticks
    }

    public void handleMessage(WebSocketSession session, String payload) {
        String roomId = sessionToRoomMap.get(session.getId());
        if (roomId != null) {
            Room room = rooms.get(roomId);
            if (room != null)
                room.handleInput(session.getId(), payload); // session.getId() is basically refering to the player in
                                                            // this context.
        }
    }

    public void handleDisconnect(WebSocketSession session) {
        String roomId = sessionToRoomMap.remove(session.getId());
        if (roomId != null) {
            Room room = rooms.get(roomId);
            if (room != null) {
                room.players.remove(session.getId());
                System.out.println("Player " + session.getId() + " disconnected.");

                if (room.players.isEmpty()) {
                    rooms.remove(roomId);
                    System.out.println("Room " + roomId + " stopped and deleted (" + rooms.size() + ") room(s) left");
                }
            }
        }
    }
}
