package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			token = c.Query("token")
		}

		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
			c.Abort()
			return
		}

		token = strings.TrimPrefix(token, "Bearer ")

		userID, username, err := parseToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的认证令牌"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Set("username", username)
		c.Next()
	}
}

func OptionalAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			token = c.Query("token")
		}

		if token != "" {
			token = strings.TrimPrefix(token, "Bearer ")
			if userID, username, err := parseToken(token); err == nil {
				c.Set("user_id", userID)
				c.Set("username", username)
			}
		}
		c.Next()
	}
}

func parseToken(token string) (string, string, error) {
	return token, "user_" + token[:8], nil
}
