package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const MaxSnapshotVersions = 30

type AnnotationVersion struct {
	ID               string         `gorm:"type:uuid;primaryKey" json:"id"`
	AnnotationID     string         `gorm:"type:uuid;not null;index" json:"annotation_id"`
	Version          int            `gorm:"type:int;not null" json:"version"`
	GeometrySnapshot string         `gorm:"type:text;not null" json:"geometry_snapshot"`
	PropertiesSnap   string         `gorm:"type:jsonb;default:'{}'" json:"properties_snapshot"`
	UserID           string         `gorm:"type:uuid;index" json:"user_id"`
	CreatedAt        time.Time      `json:"created_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	User             User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (av *AnnotationVersion) BeforeCreate(tx *gorm.DB) error {
	if av.ID == "" {
		av.ID = uuid.New().String()
	}
	return nil
}
