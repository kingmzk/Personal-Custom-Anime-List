package com.anime.backend.service;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class ImportState {

    private String status = "idle"; // idle | running | done | error
    private int total = 0;
    private int current = 0;
    private List<String> log = new ArrayList<>();

    public synchronized void logMessage(String message) {
        log.add(message);
        if (log.size() > 200) {
            log = new ArrayList<>(log.subList(log.size() - 200, log.size()));
        }
    }

    public synchronized Map<String, Object> getStateSnapshot() {
        return Map.of(
            "status", status,
            "total", total,
            "current", current,
            "log", new ArrayList<>(log)
        );
    }

    public synchronized void reset() {
        this.status = "running";
        this.total = 0;
        this.current = 0;
        this.log.clear();
    }

    public synchronized void setStatus(String status) {
        this.status = status;
    }

    public synchronized void setTotal(int total) {
        this.total = total;
    }

    public synchronized void setCurrent(int current) {
        this.current = current;
    }
    
    public synchronized int getTotal() {
        return this.total;
    }
}
