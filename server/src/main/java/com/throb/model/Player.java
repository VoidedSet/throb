package com.throb.model;

import org.springframework.web.socket.WebSocketSession;

public class Player {
    public String id;
    public WebSocketSession session;

    public double x = 0, y = 1, z = 0;
    public double rotX = 0, rotY = 0, rotZ = 0;

    public int health = 100, kills = 0, deaths = 0;
    public String[] loadout = new String[]{"fist", "pistol"};

    public Player(String id, WebSocketSession session) {
        this.id = id;
        this.session = session;
    }

    public Vector3 getPosition() {
        return new Vector3(x, y, z);
    }
}
