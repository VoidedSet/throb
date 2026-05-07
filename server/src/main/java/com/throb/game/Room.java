package com.throb.game;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.web.socket.TextMessage;

import com.throb.model.Player;

public class Room {
    private final String roomId;
    public final ConcurrentHashMap<String, Player> players = new ConcurrentHashMap<>();

    private final ScheduledExecutorService gameLoop = Executors.newSingleThreadScheduledExecutor();

    private final AtomicBoolean isRunning = new AtomicBoolean();
    // ATOMIC BOOL is basically used when multi threads r/w same bool var
    // prevents race conditions

    public Room(String id) {
        this.roomId = id;
    }

    public void start() {
        System.out.println("Room " + roomId + " started ticking at 20 tps");

        if (isRunning.compareAndSet(false, true))
            gameLoop.scheduleAtFixedRate(this::tick, 0, 50, TimeUnit.MILLISECONDS);
    }

    public void handleInput(String playerId, String payload) {
        // idhar queue the inputs so tick can handle ek ek karke
    }

    private void tick() {
        if (players.isEmpty())
            return;

        // list of all actions that will happen per tick
        // rn skipping all complicated calculations that will happen to process physics

        // state packet to be broadcasted

        StringBuilder stateJson = new StringBuilder();
        stateJson.append("{\"type\":\"STATE_UPDATE\", \"players\":{");

        boolean first = true;
        for (Player p : players.values()) {
            if (!first)
                stateJson.append(",");
            stateJson.append("\"").append(p.id).append("\":{")
                    .append("\"x\":").append(p.x).append(",")
                    .append("\"y\":").append(p.y).append(",")
                    .append("\"z\":").append(p.z).append(",")
                    .append("\"hp\":").append(p.health)
                    .append("}");
            first = false;
        }
        stateJson.append("}}");

        broadcast(stateJson.toString());
    }

    public void broadcast(String message) {
        TextMessage textMessage = new TextMessage(message);
        players.values().forEach(p -> {
            try {
                if (p.session.isOpen())
                    p.session.sendMessage(textMessage);
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
}