package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"forest-pointcloud-annotation/internal/model"
	"forest-pointcloud-annotation/internal/ws"
	"forest-pointcloud-annotation/pkg/database"
)

type AnnotationHandler struct {
	hub *ws.Hub
}

func NewAnnotationHandler(hub *ws.Hub) *AnnotationHandler {
	return &AnnotationHandler{hub: hub}
}

func (h *AnnotationHandler) List(c *gin.Context) {
	db := database.GetDB()
	pointcloudID := c.Param("pointcloud_id")

	var annotations []model.Annotation
	query := db.Where("pointcloud_id = ?", pointcloudID)

	if categoryID := c.Query("category_id"); categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}

	if err := query.Preload("Category").Order("created_at DESC").Find(&annotations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询标注列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": annotations})
}

func (h *AnnotationHandler) Get(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var annotation model.Annotation
	if err := db.Preload("Category").Preload("User").
		Preload("Versions", func(db2 *gorm.DB) *gorm.DB {
			return db2.Order("version DESC").Limit(model.MaxSnapshotVersions)
		}).First(&annotation, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "标注不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": annotation})
}

type CreateAnnotationRequest struct {
	CategoryID       string          `json:"category_id" binding:"required"`
	LayerName        string          `json:"layer_name" binding:"required"`
	PolygonGeometry  json.RawMessage `json:"polygon_geometry" binding:"required"`
	Properties       json.RawMessage `json:"properties"`
}

func (h *AnnotationHandler) Create(c *gin.Context) {
	db := database.GetDB()
	pointcloudID := c.Param("pointcloud_id")

	var pointcloud model.Pointcloud
	if err := db.First(&pointcloud, "id = ?", pointcloudID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "点云数据不存在"})
		return
	}

	var req CreateAnnotationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	if err := validatePolygonGeometry(req.PolygonGeometry); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "多边形几何校验失败: " + err.Error()})
		return
	}

	userID := c.GetString("user_id")

	propertiesStr := "{}"
	if len(req.Properties) > 0 {
		propertiesStr = string(req.Properties)
	}

	annotation := model.Annotation{
		PointcloudID:    pointcloudID,
		UserID:          userID,
		CategoryID:      req.CategoryID,
		LayerName:       req.LayerName,
		PolygonGeometry: string(req.PolygonGeometry),
		Properties:      propertiesStr,
		Version:         1,
	}

	tx := db.Begin()
	if err := tx.Create(&annotation).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建标注失败"})
		return
	}

	version := model.AnnotationVersion{
		AnnotationID:     annotation.ID,
		Version:          1,
		GeometrySnapshot: string(req.PolygonGeometry),
		PropertiesSnap:   propertiesStr,
		UserID:           userID,
	}
	if err := tx.Create(&version).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建版本快照失败"})
		return
	}

	tx.Commit()

	db.Preload("Category").Preload("User").First(&annotation, "id = ?", annotation.ID)

	h.hub.Broadcast(&ws.BroadcastMessage{
		DatasetID: pointcloudID,
		UserID:    userID,
		Type:      "annotation-create",
		Payload:   annotation,
		ExcludeID: "",
	})

	c.JSON(http.StatusCreated, gin.H{"data": annotation})
}

type UpdateAnnotationRequest struct {
	CategoryID      *string         `json:"category_id"`
	LayerName       *string         `json:"layer_name"`
	PolygonGeometry json.RawMessage `json:"polygon_geometry"`
	Properties      json.RawMessage `json:"properties"`
}

func (h *AnnotationHandler) Update(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var annotation model.Annotation
	if err := db.First(&annotation, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "标注不存在"})
		return
	}

	var req UpdateAnnotationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	userID := c.GetString("user_id")

	updates := map[string]interface{}{}
	newGeometry := annotation.PolygonGeometry
	newProperties := annotation.Properties

	if req.PolygonGeometry != nil {
		if err := validatePolygonGeometry(req.PolygonGeometry); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "多边形几何校验失败: " + err.Error()})
			return
		}
		updates["polygon_geometry"] = string(req.PolygonGeometry)
		newGeometry = string(req.PolygonGeometry)
	}

	if req.Properties != nil {
		updates["properties"] = string(req.Properties)
		newProperties = string(req.Properties)
	}

	if req.CategoryID != nil {
		updates["category_id"] = *req.CategoryID
	}
	if req.LayerName != nil {
		updates["layer_name"] = *req.LayerName
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无更新内容"})
		return
	}

	updates["version"] = annotation.Version + 1

	tx := db.Begin()
	if err := tx.Model(&annotation).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新标注失败"})
		return
	}

	newVersion := annotation.Version + 1
	version := model.AnnotationVersion{
		AnnotationID:     id,
		Version:          newVersion,
		GeometrySnapshot: newGeometry,
		PropertiesSnap:   newProperties,
		UserID:           userID,
	}
	if err := tx.Create(&version).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建版本快照失败"})
		return
	}

	var oldVersions []model.AnnotationVersion
	tx.Where("annotation_id = ? AND version <= ?", id, newVersion-model.MaxSnapshotVersions).
		Find(&oldVersions)
	if len(oldVersions) > 0 {
		for _, ov := range oldVersions {
			tx.Delete(&ov)
		}
	}

	tx.Commit()

	db.Preload("Category").Preload("User").First(&annotation, "id = ?", id)

	h.hub.Broadcast(&ws.BroadcastMessage{
		DatasetID: annotation.PointcloudID,
		UserID:    userID,
		Type:      "annotation-update",
		Payload:   annotation,
		ExcludeID: "",
	})

	c.JSON(http.StatusOK, gin.H{"data": annotation})
}

func (h *AnnotationHandler) Delete(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var annotation model.Annotation
	if err := db.First(&annotation, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "标注不存在"})
		return
	}

	userID := c.GetString("user_id")
	datasetID := annotation.PointcloudID

	if err := db.Select("Versions").Delete(&annotation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除标注失败"})
		return
	}

	h.hub.Broadcast(&ws.BroadcastMessage{
		DatasetID: datasetID,
		UserID:    userID,
		Type:      "annotation-delete",
		Payload:   map[string]string{"annotation_id": id},
		ExcludeID: "",
	})

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

func validatePolygonGeometry(geometry json.RawMessage) error {
	var geo struct {
		Type        string          `json:"type"`
		Coordinates json.RawMessage `json:"coordinates"`
	}
	if err := json.Unmarshal(geometry, &geo); err != nil {
		return err
	}

	geoType := strings.ToLower(geo.Type)
	if geoType != "polygonz" && geoType != "polygon" {
		return nil
	}

	return nil
}

func (h *AnnotationHandler) GetStats(c *gin.Context) {
	db := database.GetDB()
	pointcloudID := c.Param("pointcloud_id")

	type CategoryCount struct {
		CategoryID string `json:"category_id"`
		Count      int64  `json:"count"`
	}

	var total int64
	db.Model(&model.Annotation{}).Where("pointcloud_id = ?", pointcloudID).Count(&total)

	var categoryCounts []CategoryCount
	db.Model(&model.Annotation{}).
		Select("category_id, count(*) as count").
		Where("pointcloud_id = ?", pointcloudID).
		Group("category_id").
		Find(&categoryCounts)

	byCategory := make(map[string]int64)
	for _, cc := range categoryCounts {
		byCategory[cc.CategoryID] = cc.Count
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"total":       total,
			"by_category": byCategory,
		},
	})
}
