package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"forest-pointcloud-annotation/internal/model"
	"forest-pointcloud-annotation/pkg/database"
)

type VersionHandler struct{}

func NewVersionHandler() *VersionHandler {
	return &VersionHandler{}
}

func (h *VersionHandler) List(c *gin.Context) {
	db := database.GetDB()
	annotationID := c.Param("annotation_id")

	var annotation model.Annotation
	if err := db.First(&annotation, "id = ?", annotationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "标注不存在"})
		return
	}

	var versions []model.AnnotationVersion
	query := db.Where("annotation_id = ?", annotationID).Order("version DESC")

	if limit := c.Query("limit"); limit != "" {
	} else {
		query = query.Limit(model.MaxSnapshotVersions)
	}

	if err := query.Preload("User").Find(&versions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询版本历史失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": versions})
}

func (h *VersionHandler) Get(c *gin.Context) {
	db := database.GetDB()
	annotationID := c.Param("annotation_id")
	versionNum := c.Param("version")

	var version model.AnnotationVersion
	if err := db.Preload("User").
		Where("annotation_id = ? AND version = ?", annotationID, versionNum).
		First(&version).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "版本不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": version})
}

func (h *VersionHandler) Rollback(c *gin.Context) {
	db := database.GetDB()
	annotationID := c.Param("annotation_id")

	var annotation model.Annotation
	if err := db.First(&annotation, "id = ?", annotationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "标注不存在"})
		return
	}

	versionNum := c.Param("version")

	var targetVersion model.AnnotationVersion
	if err := db.Where("annotation_id = ? AND version = ?", annotationID, versionNum).
		First(&targetVersion).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "目标版本不存在"})
		return
	}

	userID := c.GetString("user_id")

	tx := db.Begin()

	newVersion := annotation.Version + 1
	rollbackVersion := model.AnnotationVersion{
		AnnotationID:     annotationID,
		Version:          newVersion,
		GeometrySnapshot: targetVersion.GeometrySnapshot,
		PropertiesSnap:   targetVersion.PropertiesSnap,
		UserID:           userID,
	}
	if err := tx.Create(&rollbackVersion).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建回滚版本失败"})
		return
	}

	if err := tx.Model(&annotation).Updates(map[string]interface{}{
		"polygon_geometry": targetVersion.GeometrySnapshot,
		"properties":       targetVersion.PropertiesSnap,
		"version":          newVersion,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "回滚标注失败"})
		return
	}

	tx.Commit()

	db.Preload("Category").Preload("User").First(&annotation, "id = ?", annotationID)

	c.JSON(http.StatusOK, gin.H{
		"data":    annotation,
		"message": "已回滚至版本 " + versionNum,
	})
}
