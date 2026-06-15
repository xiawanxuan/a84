package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"forest-pointcloud-annotation/internal/model"
	"forest-pointcloud-annotation/pkg/database"
)

type CategoryHandler struct{}

func NewCategoryHandler() *CategoryHandler {
	return &CategoryHandler{}
}

func (h *CategoryHandler) List(c *gin.Context) {
	db := database.GetDB()

	var categories []model.Category
	if err := db.Order("created_at ASC").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询分类列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": categories})
}

func (h *CategoryHandler) Get(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var category model.Category
	if err := db.First(&category, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": category})
}

type CreateCategoryRequest struct {
	Name        string `json:"name" binding:"required"`
	Color       string `json:"color" binding:"required"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

func (h *CategoryHandler) Create(c *gin.Context) {
	db := database.GetDB()

	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	category := model.Category{
		Name:        req.Name,
		Color:       req.Color,
		Description: req.Description,
		Icon:        req.Icon,
	}

	if err := db.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建分类失败"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": category})
}

type UpdateCategoryRequest struct {
	Name        *string `json:"name"`
	Color       *string `json:"color"`
	Description *string `json:"description"`
	Icon        *string `json:"icon"`
}

func (h *CategoryHandler) Update(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var category model.Category
	if err := db.First(&category, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	var req UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Color != nil {
		updates["color"] = *req.Color
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Icon != nil {
		updates["icon"] = *req.Icon
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无更新内容"})
		return
	}

	if err := db.Model(&category).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新分类失败"})
		return
	}

	db.First(&category, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"data": category})
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var count int64
	db.Model(&model.Annotation{}).Where("category_id = ?", id).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "该分类下存在标注，无法删除"})
		return
	}

	if err := db.Delete(&model.Category{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除分类失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}
