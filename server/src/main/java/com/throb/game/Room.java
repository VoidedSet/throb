package com.throb.game;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import com.throb.model.Player;
import com.throb.model.Vector3;

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

    private RoomState state = RoomState.WAITING;
    private int playerLimit = 2;
    private long stateEndTime = 0;

    // private int bloodGauge = 0, maxBloodGauge = 400;

    private final Vector3[] spawns = {
            new Vector3(-31.71, -8.56, -35.26), new Vector3(24.60, -7.10, -13.38),
            new Vector3(34.02, -8.54, 19.26), new Vector3(-28.52, -8.55, 32.34)

    };

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

            Player p = players.get(playerId);
            if (p == null)
                return;

            if ("LOADOUT".equals(type)) {
                JsonNode loadoutNode = node.get("loadout");
                if (loadoutNode != null && loadoutNode.isArray()) {
                    p.setLoadout(new String[] { loadoutNode.get(0).asString(), loadoutNode.get(1).asString() });
                    p.ammo = getWeaponAmmo(p.loadout[1]);
                    System.out.println("[" + p.id + "] selected loadout: " + p.loadout[0] + ", " + p.loadout[1]);
                }
            } else if ("WEAPON_SWITCH".equals(type)) {
                int slot = node.has("slot") ? node.get("slot").asInt(0) : 0;
                if (p.loadout != null && slot >= 0 && slot < p.loadout.length) {
                    p.activeSlot = slot;
                }
            } else if ("INPUT".equals(type) && state == RoomState.GAMEPLAY) {
                JsonNode pos = node.get("pos");
                JsonNode rot = node.get("rot");
                // JsonNode vel = node.get("vel");

                if (node.has("seq")) {
                    int seq = node.get("seq").asInt();
                    if (seq <= p.lastProcessedSeq) {
                        return;
                    }
                    p.lastProcessedSeq = seq;
                }

                if (node.has("isMoving"))
                    p.isMoving = node.get("isMoving").asBoolean();
                if (node.has("isSprinting"))
                    p.isSprinting = node.get("isSprinting").asBoolean();

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
                // future implementation
                // if (vel != null) {
                // if (vel.has("x"))
                // p.vx = vel.get("x").asDouble();
                // if (vel.has("y"))
                // p.vy = vel.get("y").asDouble();
                // if (vel.has("z"))
                // p.vz = vel.get("z").asDouble();
                // }
            } else if ("RELOAD".equals(type) && state == RoomState.GAMEPLAY) {
                if (p.loadout != null && p.loadout.length > 0) {
                    int idx = Math.max(0, Math.min(p.activeSlot, p.loadout.length - 1));
                    p.ammo = getWeaponAmmo(p.loadout[idx]);
                }
            } else if ("SHOOT".equals(type) && state == RoomState.GAMEPLAY) {
                String targetId = node.has("targetId") ? node.get("targetId").asString() : "";
                String weaponUsed = node.has("weapon") ? node.get("weapon").asString() : "";
                Player target = players.get(targetId);

                // Server-authoritative weapon -> derive from activeSlot
                String authoritativeWeapon = "";
                if (p.loadout != null && p.loadout.length > 0) {
                    int idx = Math.max(0, Math.min(p.activeSlot, p.loadout.length - 1));
                    authoritativeWeapon = p.loadout[idx];
                }

                if (authoritativeWeapon == null || authoritativeWeapon.isEmpty()) {
                    System.out.println("[F] " + p.id + " has no weapon in active slot");
                    return;
                }

                if (!weaponUsed.equalsIgnoreCase(authoritativeWeapon)) {
                    System.out.println("[F] " + p.id + " claimed " + weaponUsed + " but active slot is "
                            + authoritativeWeapon + " - overriding");
                    weaponUsed = authoritativeWeapon;
                }

                if (p.ammo <= 0 && !isMeleeWeapon(weaponUsed)) {
                    System.out.println("[F] " + p.id + " tried to shoot with empty weapon: " + weaponUsed);
                    return;
                }

                if (!isMeleeWeapon(weaponUsed)) {
                    int cost = weaponUsed.equalsIgnoreCase("shotgun") ? 2 : 1;
                    p.ammo = Math.max(0, p.ammo - cost);
                }

                if (target != null && target.health > 0) {

                    // 1. Distance Check (Is target within 100 units?)
                    double dist = p.getPosition().distanceTo(target.getPosition());
                    if (dist < 100.0) {

                        // 2. Angle Check (Is shooter actually facing the target?)
                        JsonNode dirNode = node.get("dir");
                        if (dirNode != null) {
                            Vector3 shootDir = new Vector3(
                                    dirNode.get("x").asDouble(),
                                    dirNode.get("y").asDouble(),
                                    dirNode.get("z").asDouble()).normalize();

                            // Vector from shooter to target
                            Vector3 toTarget = target.getPosition().subtract(p.getPosition()).normalize();

                            // Dot product checks the angle.
                            // > 0.85 gives a small cone of leniency for lag/hitboxes.
                            double dot = shootDir.dot(toTarget);
                            if (dot > 0.85) {

                                // HIT CONFIRMED! Server takes action.
                                // System.out.println("[T] " + p.id + " shot and hit " + target.id + "!");
                                int damage = getWeaponDamage(weaponUsed);
                                int actualDamage = Math.min((int) Math.ceil(target.blood), damage);
                                target.blood = Math.max(0.0, target.blood - actualDamage);
                                target.health = (int) Math.max(0, Math.ceil(target.blood));

                                target.damageReceivedFrom.put(p.id,
                                        target.damageReceivedFrom.getOrDefault(p.id, 0) + actualDamage);

                                ObjectNode dmgPacket = mapper.createObjectNode();

                                if (target.health <= 0) {
                                    p.kills++;
                                    target.deaths++;

                                    int bloodToGive = (int) (target.damageReceivedFrom.getOrDefault(p.id, 0) * 0.75);
                                    p.blood = Math.min(300.0, p.blood + bloodToGive);
                                    p.health = (int) Math.round(p.blood);
                                    target.damageReceivedFrom.clear();

                                    Vector3 sp = spawns[(int) (Math.random() * spawns.length)];
                                    target.health = 300;
                                    target.blood = 300.0;
                                    target.x = sp.x;
                                    target.y = sp.y;
                                    target.z = sp.z;

                                    dmgPacket.put("type", "KILL");
                                    dmgPacket.put("killerId", p.id);
                                    dmgPacket.put("killedId", target.id);
                                    dmgPacket.put("weapon", weaponUsed);

                                    ObjectNode spNode = dmgPacket.putObject("spawn");
                                    spNode.put("x", sp.x);
                                    spNode.put("y", sp.y);
                                    spNode.put("z", sp.z);

                                } else {
                                    dmgPacket.put("type", "DAMAGE");
                                    dmgPacket.put("targetId", target.id);
                                    dmgPacket.put("hp", target.health);
                                    dmgPacket.put("weapon", weaponUsed);
                                }

                                // Tell everyone what happened instantly (don't wait for tick)
                                broadcast(dmgPacket.toString());
                            } else {
                                System.out.println("[F] " + p.id + " shot, but missed angle check!");
                            }
                        }
                    } else {
                        System.out.println("[F] " + p.id + " shot, but missed distance check!");
                    }
                }
            }
        } catch (

        Exception e) {
            e.printStackTrace();
        }
    }

    private void updateLogic() {
        long now = System.currentTimeMillis();

        switch (state) {
            case WAITING:
                if (players.size() >= playerLimit) {
                    state = RoomState.LOADOUT_SELECTION;
                    stateEndTime = now + 15000; // 20s
                    System.out.println("Room " + roomId + " -> Loadout with wait time " + stateEndTime);
                }
                break;

            case LOADOUT_SELECTION:
                if (now >= stateEndTime) {
                    state = RoomState.GAMEPLAY;

                    stateEndTime = now + 600000;

                    System.out.println("Room " + roomId + " -> Gameplay");

                    int i = 0;
                    for (Player p : players.values()) {
                        Vector3 sp = spawns[i % spawns.length];
                        p.x = sp.x;
                        p.y = sp.y;
                        p.z = sp.z;
                        p.health = 300;
                        p.blood = 300.0;
                        i++;
                    }
                }
                break;

            case GAMEPLAY:
                for (Player p : players.values()) {
                    if (p.kills >= 2) {
                        state = RoomState.MATCH_RESULTS;
                        stateEndTime = now + 15000;
                        System.out
                                .println("Room " + roomId + " -> Match Ended because player " + p.id + " got 2 kills.");

                        com.throb.network.SupabaseClient.saveMatchResults(roomId, players.values(), p.id);
                        break;
                    }
                }
                break;

            case HEART_EXPLOADED:
                if (now >= stateEndTime) {
                    state = RoomState.MATCH_RESULTS;
                    stateEndTime = now + 15000;
                    System.out.println("Room " + roomId + " -> Results");
                }
                break;

            case MATCH_RESULTS:
                if (now >= stateEndTime) {
                    System.out.println("Match in Room " + roomId + " end. kicking players and closing room");

                    for (Player p : players.values())
                        kickPlayer(p.id, "MATCH_ENDED");
                }
                break;

            default:
                break;
        }
    }

    private void tick() {
        if (players.isEmpty())
            return;
        try {
            updateLogic();

            if (state == RoomState.GAMEPLAY) {
                for (Player p : players.values()) {
                    // Void death first
                    if (p.y < -15) {
                        p.deaths++;
                        p.damageReceivedFrom.clear();
                        Vector3 sp = spawns[(int) (Math.random() * spawns.length)];
                        p.x = sp.x;
                        p.y = sp.y;
                        p.z = sp.z;
                        p.health = 300;
                        p.blood = 300.0;

                        ObjectNode dmgPacket = mapper.createObjectNode();
                        dmgPacket.put("type", "KILL");
                        dmgPacket.put("killerId", "");
                        dmgPacket.put("killedId", p.id);
                        ObjectNode spNode = dmgPacket.putObject("spawn");
                        spNode.put("x", sp.x);
                        spNode.put("y", sp.y);
                        spNode.put("z", sp.z);
                        broadcast(dmgPacket.toString());
                        continue;
                    }

                    double decrease = 0.0;
                    if (p.isSprinting)
                        decrease = (5.0 / 20.0);
                    else if (p.isMoving)
                        decrease = (1.0 / 20.0);

                    if (decrease > 0) {
                        // If subtracting this tick would drop below zero, kill now
                        if (p.blood - decrease <= 0.0) {
                            p.deaths++;
                            p.damageReceivedFrom.clear();
                            Vector3 sp = spawns[(int) (Math.random() * spawns.length)];
                            p.x = sp.x;
                            p.y = sp.y;
                            p.z = sp.z;
                            p.health = 300;
                            p.blood = 300.0;

                            ObjectNode dmgPacket = mapper.createObjectNode();
                            dmgPacket.put("type", "KILL");
                            dmgPacket.put("killerId", "");
                            dmgPacket.put("killedId", p.id);
                            ObjectNode spNode = dmgPacket.putObject("spawn");
                            spNode.put("x", sp.x);
                            spNode.put("y", sp.y);
                            spNode.put("z", sp.z);
                            broadcast(dmgPacket.toString());
                            continue;
                        } else {
                            p.blood = p.blood - decrease;
                            p.health = (int) Math.ceil(p.blood);
                        }
                    } else {
                        // No movement-based drain; ensure health sync
                        p.health = (int) Math.ceil(p.blood);
                    }
                }
            }

            try {
                ObjectNode root = mapper.createObjectNode();

                root.put("type", "STATE_UPDATE");
                root.put("state", state.id);
                // root.put("blood", bloodGauge); // Global blood removed

                if (state == RoomState.LOADOUT_SELECTION || state == RoomState.MATCH_RESULTS
                        || state == RoomState.GAMEPLAY) {
                    long timeLeft = Math.max(0, (stateEndTime - System.currentTimeMillis()) / 1000);
                    root.put("timer", timeLeft);
                }

                if (state == RoomState.GAMEPLAY || state == RoomState.HEART_EXPLOADED
                        || state == RoomState.MATCH_RESULTS) {
                    ObjectNode playersNode = root.putObject("players");
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

                        // ObjectNode vel = pNode.putObject("vel");
                        // vel.put("x", p.vx);
                        // vel.put("y", p.vy);
                        // vel.put("z", p.vz);

                        pNode.put("hp", p.health);
                        pNode.put("blood", p.blood);

                        pNode.put("kills", p.kills);
                        pNode.put("deaths", p.deaths);

                        if (p.loadout != null && p.loadout.length == 2) {
                            pNode.put("w1", p.loadout[0]);
                            pNode.put("w2", p.loadout[1]);
                        }
                        pNode.put("ammo", p.ammo);
                        pNode.put("seq", p.lastProcessedSeq);
                    }
                }

                broadcast(mapper.writeValueAsString(root));
            } catch (Exception e) {
                e.printStackTrace();
            }
        } catch (Throwable t) {
            System.err.println("[Room " + roomId + "] TICK CRASH CAUGHT:");
            t.printStackTrace();
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

    private boolean isMeleeWeapon(String weapon) {
        return "fist".equalsIgnoreCase(weapon) || "slap".equalsIgnoreCase(weapon);
    }

    private int getWeaponAmmo(String weapon) {
        return switch (weapon.toLowerCase()) {
            case "pistol" -> 12;
            case "shotgun" -> 8;
            case "smg" -> 25;
            case "sniper" -> 4;
            default -> 0;
        };
    }

    private int getWeaponDamage(String weapon) {
        return switch (weapon.toLowerCase()) {
            case "fist" -> 5;
            case "slap" -> 10;
            case "pistol" -> 20;
            case "shotgun" -> 70;
            case "smg" -> 10;
            case "sniper" -> 80;
            default -> 0;
        };
    }

    // gracefully kicking player from a room!
    public void kickPlayer(String targetId, String reason) {
        Player target = players.get(targetId);
        if (target != null && target.session.isOpen()) {
            try {
                ObjectNode kickMsg = mapper.createObjectNode();
                kickMsg.put("type", "KICKED");
                kickMsg.put("reason", reason);
                target.session.sendMessage(new TextMessage(kickMsg.toString()));

                target.session.close();
                System.out.println("[Room] Kicked player " + targetId + ". Reason: " + reason);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}