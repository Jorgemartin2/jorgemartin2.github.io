package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "path/filepath"
    "strings"

    "github.com/gorilla/mux"
)

type AuditResponse struct {
    Log     string `json:"log"`
    Content string `json:"content"`
}

type ErrorResponse struct {
    Message string `json:"message"`
}

func sanitizeFileName(name string) string {
    return filepath.Base(name)
}

func checkPathTraversal(name string) bool {
    if strings.Contains(name, "..") || strings.Contains(name, "/") {
        return true
    }

    return false
}

func main() {
    err := os.MkdirAll("logs", 0755)
    if err != nil {
        fmt.Println("Error to create logs directory:", err)
        return
    }

    filePath := ""

    r := mux.NewRouter()

    r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "text/plain")

        content, err := os.ReadFile("main.go")
        if err != nil {
            w.WriteHeader(http.StatusInternalServerError)
            w.Write([]byte("Error reading source code"))
            return
        }

        w.Write(content)
    }).Methods("GET")

    r.HandleFunc("/audit", func(w http.ResponseWriter, r *http.Request) {
        logParam := r.URL.Query().Get("log")

        if logParam != "" {
            filePath = logParam

            pathTraversal := checkPathTraversal(filePath)
            if pathTraversal {
                filePath = sanitizeFileName(filePath)
            }
        } else {
            filePath = "last-activity.txt"
        }

        filePath = filepath.Join("logs", filePath)

        content, err := os.ReadFile(filePath)
        if err != nil {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusNotFound)

            errorResponse := ErrorResponse{
                Message: "Log not found",
            }

            json.NewEncoder(w).Encode(errorResponse)
            return
        }

        response := AuditResponse{
            Log:     logParam,
            Content: string(content),
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(response)
    }).Methods("GET")

    r.HandleFunc("/audit/list", func(w http.ResponseWriter, r *http.Request) {
        files, err := os.ReadDir("logs")

        if err != nil {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusInternalServerError)

            errorResponse := ErrorResponse{
                Message: "Could not list logs",
            }

            json.NewEncoder(w).Encode(errorResponse)
            return
        }

        var logFiles []string
        for _, file := range files {
            if !file.IsDir() {
                logFiles = append(logFiles, file.Name())
            }
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(logFiles)
    }).Methods("GET")

    // r.HandleFunc("/get-flag", func(w http.ResponseWriter, r *http.Request) {
    //  w.Header().Set("Content-Type", "text/plain")

    //  content, err := os.ReadFile("./flag.txt")
    //  if err != nil {
    //      w.WriteHeader(http.StatusInternalServerError)
    //      w.Write([]byte("Error reading flag"))
    //      return
    //  }

    //  w.Write(content)

    // }).Methods("GET")

    fmt.Println("Server running on port 8000...")
    http.ListenAndServe(":8000", r)
}