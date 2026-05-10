package com.throb.model;

import org.springframework.web.socket.WebSocketSession;

public class Player {
    public String id;
    public WebSocketSession session;

    public double x = 0, y = 1, z = 0;
    public double rotX = 0, rotY = 0, rotZ = 0;
    public double vx = 0, vy = 0, vz = 0; // adding velo shi to improve interpolation in player movements and make it
                                          // feel smooth even if the oponents have higher ping

    public int health = 100, kills = 0, deaths = 0;
    public String[] loadout = new String[] { "fist", "pistol" };
    public int activeSlot = 0;
    public int ammo = 0;

    public Player(String id, WebSocketSession session) {
        this.id = id;
        this.session = session;
    }

    public void setLoadout(String[] loadout) {
        this.loadout = loadout;
        this.activeSlot = 0;
        this.ammo = 0;
    }

    public Vector3 getPosition() {
        return new Vector3(x, y, z);
    }
}
