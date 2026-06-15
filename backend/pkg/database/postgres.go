package database

import (
	"fmt"
	"time"

	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"forest-pointcloud-annotation/pkg/config"
	zaplogger "forest-pointcloud-annotation/pkg/logger"
)

var DB *gorm.DB

type gormLogger struct {
	*zap.SugaredLogger
}

func (l *gormLogger) Printf(format string, v ...interface{}) {
	l.Infof(format, v...)
}

func Init(cfg *config.PostgresConfig) error {
	newLogger := logger.New(
		&gormLogger{SugaredLogger: zaplogger.Sugar},
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		return fmt.Errorf("connect postgres failed: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("get sql.DB failed: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	zaplogger.Sugar.Info("postgres connected successfully")
	DB = db
	return nil
}

func GetDB() *gorm.DB {
	return DB
}
