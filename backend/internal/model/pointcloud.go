package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Pointcloud struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string         `gorm:"type:varchar(255);not null" json:"name"`
	FilePath    string         `gorm:"type:varchar(512);not null" json:"file_path"`
	PointCount  int64          `gorm:"type:bigint;default:0" json:"point_count"`
	BoundingBox string         `gorm:"type:text" json:"bounding_box"`
	Metadata    string         `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Annotations []Annotation   `gorm:"foreignKey:PointcloudID" json:"annotations,omitempty"`
}

func (p *Pointcloud) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}
