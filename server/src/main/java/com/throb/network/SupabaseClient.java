package com.throb.network;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Collection;

import com.throb.model.Player;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

public class SupabaseClient {
    private static final String URL = "https://-.supabase.co/rest/v1/",
            KEY = "-";

    private static final HttpClient client = HttpClient.newHttpClient();
    private static final ObjectMapper mapper = new ObjectMapper();

    public static void saveMatchResults(String roomId, Collection<Player> players, String winnerId) {
        try {
            ArrayNode rows = mapper.createArrayNode();

            for (Player p : players) {
                ObjectNode row = mapper.createObjectNode();
                row.put("room_id", roomId);
                row.put("username", p.id); // using session id as username for now
                row.put("kills", p.kills);
                row.put("deaths", p.deaths);
                row.put("score", p.kills * 100);
                row.put("is_winner", p.id.equals(winnerId));
                rows.add(row);
            }

            String payload = mapper.writeValueAsString(rows);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(URL))
                    .header("Content-Type", "application/json")
                    .header("apikey", KEY)
                    .header("Authorization", "Bearer " + KEY)
                    .header("Prefer", "return=minimal") // Don't return inserted rows, saves bandwidth
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                    .thenAccept(res -> System.out.println("[Supabase] Match saved. Code: " + res.statusCode()));

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}