package router

import (
	"github.com/gin-gonic/gin"

	"forest-pointcloud-annotation/internal/handler"
	"forest-pointcloud-annotation/internal/middleware"
	"forest-pointcloud-annotation/internal/ws"
)

func SetupRouter(
	pch *handler.PointcloudHandler,
	ah *handler.AnnotationHandler,
	ch *handler.CategoryHandler,
	wsh *handler.WebSocketHandler,
	vh *handler.VersionHandler,
	hub *ws.Hub,
) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORSMiddleware())

	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		pointclouds := api.Group("/pointclouds")
		{
			pointclouds.GET("", pch.List)
			pointclouds.GET("/tree", pch.GetTree)
			pointclouds.GET("/:id", pch.Get)
			pointclouds.POST("", pch.Create)
			pointclouds.PUT("/:id", pch.Update)
			pointclouds.DELETE("/:id", pch.Delete)
			pointclouds.GET("/:pointcloud_id/annotations", pch.GetAnnotations)
		}

		annotations := api.Group("/pointclouds/:pointcloud_id/annotations")
		{
			annotations.GET("", ah.List)
			annotations.POST("", ah.Create)
			annotations.GET("/stats", ah.GetStats)
		}

		annotationDetail := api.Group("/annotations")
		{
			annotationDetail.GET("/:id", ah.Get)
			annotationDetail.PUT("/:id", ah.Update)
			annotationDetail.DELETE("/:id", ah.Delete)
		}

		versions := api.Group("/annotations/:annotation_id/versions")
		{
			versions.GET("", vh.List)
			versions.GET("/:version", vh.Get)
			versions.POST("/:version/rollback", vh.Rollback)
		}

		categories := api.Group("/categories")
		{
			categories.GET("", ch.List)
			categories.GET("/:id", ch.Get)
			categories.POST("", ch.Create)
			categories.PUT("/:id", ch.Update)
			categories.DELETE("/:id", ch.Delete)
		}
	}

	r.GET("/ws", middleware.OptionalAuthMiddleware(), wsh.HandleConnection)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	return r
}
