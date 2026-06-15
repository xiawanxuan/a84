package main

import (
	"fmt"
	"syscall"

	"github.com/gin-gonic/gin"

	"forest-pointcloud-annotation/internal/handler"
	"forest-pointcloud-annotation/internal/model"
	"forest-pointcloud-annotation/internal/router"
	"forest-pointcloud-annotation/internal/ws"
	"forest-pointcloud-annotation/pkg/config"
	"forest-pointcloud-annotation/pkg/database"
	zaplogger "forest-pointcloud-annotation/pkg/logger"
	pkgredis "forest-pointcloud-annotation/pkg/redis"
)

func main() {
	cfg, err := config.Load("configs/config.yaml")
	if err != nil {
		fmt.Printf("load config failed: %v\n", err)
		syscall.Exit(1)
	}

	if err := zaplogger.Init(&cfg.Logger); err != nil {
		fmt.Printf("init logger failed: %v\n", err)
		syscall.Exit(1)
	}
	defer zaplogger.Sync()

	if err := database.Init(&cfg.Postgres); err != nil {
		zaplogger.Sugar.Fatalf("init database failed: %v", err)
	}

	db := database.GetDB()
	db.AutoMigrate(
		&model.User{},
		&model.Pointcloud{},
		&model.Category{},
		&model.Annotation{},
		&model.AnnotationVersion{},
	)

	if err := pkgredis.Init(&cfg.Redis); err != nil {
		zaplogger.Sugar.Fatalf("init redis failed: %v", err)
	}

	hub := ws.NewHub()
	go hub.Run()

	pch := handler.NewPointcloudHandler()
	ah := handler.NewAnnotationHandler(hub)
	ch := handler.NewCategoryHandler()
	wsh := handler.NewWebSocketHandler(hub)
	vh := handler.NewVersionHandler()

	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := router.SetupRouter(pch, ah, ch, wsh, vh, hub)

	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	zaplogger.Sugar.Infof("server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		zaplogger.Sugar.Fatalf("server start failed: %v", err)
	}
}
