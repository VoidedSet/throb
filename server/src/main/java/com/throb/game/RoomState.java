package com.throb.game;

public enum RoomState {
    WAITING(0),
    LOADOUT_SELECTION(1),
    GAMEPLAY(2),
    HEART_EXPLOADED(3),
    MATCH_RESULTS(4);

    public final int id;

    RoomState(int id) {
        this.id = id;
    }
}
