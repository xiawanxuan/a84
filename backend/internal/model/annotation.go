package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Annotation struct {
	ID             string               `gorm:"type:uuid;primaryKey" json:"id"`
	PointcloudID   string               `gorm:"type:uuid;not null;index" json:"pointcloud_id"`
	UserID         string               `gorm:"type:uuid;index" json:"user_id"`
	CategoryID     string               `gorm:"type:uuid;not null;index" json:"category_id"`
	LayerName      string               `gorm:"type:varchar(100);not null" json:"layer_name"`
	PolygonGeometry string              `gorm:"type:text;not null" json:"polygon_geometry"`
	Properties     string               `gorm:"type:jsonb;default:'{}'" json:"properties"`
	Version        int                  `gorm:"type:int;default:1" json:"version"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
	DeletedAt      gorm.DeletedAt       `gorm:"index" json:"-"`
	User           User                 `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Category       Category             `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Versions       []AnnotationVersion  `gorm:"foreignKey:AnnotationID" json:"versions,omitempty"`
}

func (a *Annotation) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	return nil
}
