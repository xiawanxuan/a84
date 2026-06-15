package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"forest-pointcloud-annotation/internal/model"
	"forest-pointcloud-annotation/pkg/database"
)

type PointcloudHandler struct{}

func NewPointcloudHandler() *PointcloudHandler {
	return &PointcloudHandler{}
}

func (h *PointcloudHandler) List(c *gin.Context) {
	db := database.GetDB()

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var total int64
	var pointclouds []model.Pointcloud

	query := db.Model(&model.Pointcloud{})
	if search := c.Query("search"); search != "" {
		query = query.Where("name ILIKE ?", "%"+search+"%")
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&pointclouds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询点云列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": pointclouds,
		"pagination": gin.H{
			"page":       page,
			"page_size":  pageSize,
			"total":      total,
			"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
		},
	})
}

func (h *PointcloudHandler) Get(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var pointcloud model.Pointcloud
	if err := db.First(&pointcloud, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "点云数据不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": pointcloud})
}

type CreatePointcloudRequest struct {
	Name       string `json:"name" binding:"required"`
	FilePath   string `json:"file_path" binding:"required"`
	PointCount int64  `json:"point_count"`
	Metadata   string `json:"metadata"`
}

func (h *PointcloudHandler) Create(c *gin.Context) {
	db := database.GetDB()

	var req CreatePointcloudRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	pointcloud := model.Pointcloud{
		Name:       req.Name,
		FilePath:   req.FilePath,
		PointCount: req.PointCount,
		Metadata:   req.Metadata,
	}

	if err := db.Create(&pointcloud).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建点云记录失败"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": pointcloud})
}

type UpdatePointcloudRequest struct {
	Name       string `json:"name"`
	FilePath   string `json:"file_path"`
	PointCount int64  `json:"point_count"`
	Metadata   string `json:"metadata"`
}

func (h *PointcloudHandler) Update(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var pointcloud model.Pointcloud
	if err := db.First(&pointcloud, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "点云数据不存在"})
		return
	}

	var req UpdatePointcloudRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.FilePath != "" {
		updates["file_path"] = req.FilePath
	}
	if req.PointCount > 0 {
		updates["point_count"] = req.PointCount
	}
	if req.Metadata != "" {
		updates["metadata"] = req.Metadata
	}

	if err := db.Model(&pointcloud).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新点云记录失败"})
		return
	}

	db.First(&pointcloud, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"data": pointcloud})
}

func (h *PointcloudHandler) Delete(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var pointcloud model.Pointcloud
	if err := db.First(&pointcloud, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "点云数据不存在"})
		return
	}

	if err := db.Delete(&pointcloud).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除点云记录失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

func (h *PointcloudHandler) GetAnnotations(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var pointcloud model.Pointcloud
	if err := db.First(&pointcloud, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "点云数据不存在"})
		return
	}

	var annotations []model.Annotation
	query := db.Where("pointcloud_id = ?", id)

	if categoryID := c.Query("category_id"); categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}
	if layerName := c.Query("layer_name"); layerName != "" {
		query = query.Where("layer_name = ?", layerName)
	}

	if err := query.Preload("Category").Preload("User").Order("created_at DESC").Find(&annotations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询标注列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": annotations})
}

func (h *PointcloudHandler) GetTree(c *gin.Context) {
	db := database.GetDB()

	var pointclouds []model.Pointcloud
	if err := db.Select("id, name, point_count, created_at").Order("name ASC").Find(&pointclouds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询点云目录失败"})
		return
	}

	type TreeNode struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		Type       string `json:"type"`
		PointCount int64  `json:"point_count,omitempty"`
		Children   []TreeNode `json:"children,omitempty"`
	}

	nodes := make([]TreeNode, 0, len(pointclouds))
	for _, pc := range pointclouds {
		nodes = append(nodes, TreeNode{
			ID:         pc.ID,
			Name:       pc.Name,
			Type:       "dataset",
			PointCount: pc.PointCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"data": TreeNode{
			ID:       "root",
			Name:     "机载勘测点云",
			Type:     "folder",
			Children: nodes,
		},
	})
}
