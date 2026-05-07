package com.throb.game;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import com.throb.model.Player;
import org.springframework.web.socket.TextMessage;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class Room {
    private final String roomId;
    public final ConcurrentHashMap<String, Player> players = new ConcurrentHashMap<>();
    private final ScheduledExecutorService gameLoop = Executors.newSingleThreadScheduledExecutor();
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final ObjectMapper mapper = new ObjectMapper();

    public Room(String roomId) {
        this.roomId = roomId;
    }

    public void start() {
        System.out.println("Room " + roomId + " started ticking at 20 tps");
        if (isRunning.compareAndSet(false, true)) {
            gameLoop.scheduleAtFixedRate(this::tick, 0, 50, TimeUnit.MILLISECONDS);
        }
    }

    public void handleInput(String playerId, String payload) {
        try {
            JsonNode node = mapper.readTree(payload);
            String type = node.has("type") ? node.get("type").asString() : "";

            if ("INPUT".equals(type)) {
                Player p = players.get(playerId);
                if (p != null) {
                    JsonNode pos = node.get("pos");
                    JsonNode rot = node.get("rot");

                    if (pos != null) {
                        if (pos.has("x"))
                            p.x = pos.get("x").asDouble();
                        if (pos.has("y"))
                            p.y = pos.get("y").asDouble();
                        if (pos.has("z"))
                            p.z = pos.get("z").asDouble();
                    }
                    if (rot != null) {
                        if (rot.has("x"))
                            p.rotX = rot.get("x").asDouble();
                        if (rot.has("y"))
                            p.rotY = rot.get("y").asDouble();
                        if (rot.has("z"))
                            p.rotZ = rot.get("z").asDouble();
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void tick() {
        if (players.isEmpty())
            return;

        try {
            ObjectNode state = mapper.createObjectNode();
            state.put("type", "STATE_UPDATE");
            ObjectNode playersNode = state.putObject("players");

            for (Player p : players.values()) {
                ObjectNode pNode = playersNode.putObject(p.id);

                ObjectNode pos = pNode.putObject("pos");
                pos.put("x", p.x);
                pos.put("y", p.y);
                pos.put("z", p.z);

                ObjectNode rot = pNode.putObject("rot");
                rot.put("x", p.rotX);
                rot.put("y", p.rotY);
                rot.put("z", p.rotZ);

                pNode.put("hp", p.health);
            }

            broadcast(mapper.writeValueAsString(state));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void broadcast(String message) {
        TextMessage textMessage = new TextMessage(message);
        players.values().forEach(p -> {
            try {
                if (p.session.isOpen()) {
                    p.session.sendMessage(textMessage);
                }
            } catch (Exception ignored) {
            }
        });
    }
}