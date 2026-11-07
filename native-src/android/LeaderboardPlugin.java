package com.lumifly.game;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.AnnotatedData;
import com.google.android.gms.games.LeaderboardsClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.leaderboard.LeaderboardScore;
import com.google.android.gms.games.leaderboard.LeaderboardScoreBuffer;
import com.google.android.gms.games.leaderboard.LeaderboardVariant;

/**
 * Lumi Fly leaderboards via Google Play Games Services v2.
 * load(): top scores (up to 500, pages of 25) + the player's own rank.
 * submit(): sends a score (Google keeps the best one per player).
 */
@CapacitorPlugin(name = "Leaderboard")
public class LeaderboardPlugin extends Plugin {
    private boolean ready = false;

    @Override
    public void load() {
        if (hasAppId()) {
            try { PlayGamesSdk.initialize(getContext()); ready = true; } catch (Exception e) { ready = false; }
        }
    }

    private boolean hasAppId() {
        try {
            ApplicationInfo ai = getContext().getPackageManager().getApplicationInfo(getContext().getPackageName(), PackageManager.GET_META_DATA);
            Bundle b = ai.metaData;
            return b != null && b.get("com.google.android.gms.games.APP_ID") != null;
        } catch (Exception e) { return false; }
    }

    private int span(String p) {
        if ("d".equals(p)) return LeaderboardVariant.TIME_SPAN_DAILY;
        if ("w".equals(p)) return LeaderboardVariant.TIME_SPAN_WEEKLY;
        return LeaderboardVariant.TIME_SPAN_ALL_TIME;
    }

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject(); r.put("available", ready); call.resolve(r);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        if (!ready) { call.reject("not configured"); return; }
        PlayGames.getGamesSignInClient(getActivity()).isAuthenticated().addOnCompleteListener(t -> {
            if (t.isSuccessful() && t.getResult().isAuthenticated()) { JSObject r = new JSObject(); r.put("signedIn", true); call.resolve(r); return; }
            PlayGames.getGamesSignInClient(getActivity()).signIn().addOnCompleteListener(t2 -> {
                JSObject r = new JSObject();
                r.put("signedIn", t2.isSuccessful() && t2.getResult().isAuthenticated());
                call.resolve(r);
            });
        });
    }

    @PluginMethod
    public void submit(PluginCall call) {
        String id = call.getString("id"); Long score = call.getLong("score");
        if (!ready || id == null || score == null) { call.resolve(); return; }
        try { PlayGames.getLeaderboardsClient(getActivity()).submitScore(id, score); } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void load(PluginCall call) {
        if (!ready) { call.reject("not configured"); return; }
        String id = call.getString("id"); int ts = span(call.getString("span", "a"));
        int max = Math.min(500, call.getInt("max", 500));
        LeaderboardsClient lc = PlayGames.getLeaderboardsClient(getActivity());
        lc.loadTopScores(id, ts, LeaderboardVariant.COLLECTION_PUBLIC, 25, true).addOnCompleteListener(t -> {
            if (!t.isSuccessful() || t.getResult() == null || t.getResult().get() == null) { call.reject("load failed"); return; }
            page(lc, t.getResult().get().getScores(), max, id, ts, call);
        });
    }

    // keeps loading pages of 25 until 'max' rows or no more scores
    private void page(LeaderboardsClient lc, LeaderboardScoreBuffer buf, int max, String id, int ts, PluginCall call) {
        int n = buf.getCount();
        if (n >= max) { finish(lc, buf, max, id, ts, call); return; }
        lc.loadMoreScores(buf, 25, com.google.android.gms.games.PageDirection.NEXT).addOnCompleteListener(t -> {
            if (!t.isSuccessful() || t.getResult() == null || t.getResult().get() == null) { finish(lc, buf, max, id, ts, call); return; }
            LeaderboardScoreBuffer nb = t.getResult().get().getScores();
            if (nb.getCount() <= n) { finish(lc, nb, max, id, ts, call); return; }
            page(lc, nb, max, id, ts, call);
        });
    }

    private void finish(LeaderboardsClient lc, LeaderboardScoreBuffer buf, int max, String id, int ts, PluginCall call) {
        JSArray rows = new JSArray();
        int n = Math.min(buf.getCount(), max);
        for (int i = 0; i < n; i++) {
            LeaderboardScore s = buf.get(i);
            JSObject o = new JSObject();
            o.put("rank", s.getRank()); o.put("s", s.getRawScore()); o.put("n", s.getScoreHolderDisplayName());
            rows.put(o);
        }
        buf.release();
        lc.loadCurrentPlayerLeaderboardScore(id, ts, LeaderboardVariant.COLLECTION_PUBLIC).addOnCompleteListener(t -> {
            JSObject r = new JSObject(); r.put("rows", rows);
            if (t.isSuccessful() && t.getResult() != null && t.getResult().get() != null) {
                LeaderboardScore me = t.getResult().get();
                JSObject m = new JSObject(); m.put("rank", me.getRank()); m.put("s", me.getRawScore()); m.put("n", me.getScoreHolderDisplayName());
                r.put("me", m);
            }
            call.resolve(r);
        });
    }
}
