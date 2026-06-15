package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"

	"forest-pointcloud-annotation/pkg/config"
	zaplogger "forest-pointcloud-annotation/pkg/logger"
)

var Client *redis.Client

func Init(cfg *config.RedisConfig) error {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr(),
		Password: cfg.Password,
		DB:       cfg.DB,
		PoolSize: cfg.PoolSize,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis ping failed: %w", err)
	}

	zaplogger.Sugar.Info("redis connected successfully")
	Client = rdb
	return nil
}

func GetClient() *redis.Client {
	return Client
}
