package router

import (
	"time"

	"go-service/internal/auth"
	"go-service/internal/handler"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(
	taskHandler *handler.TaskHandler,
	logHandler *handler.BlockchainLogHandler,
	authHandler *handler.AuthHandler,
) *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api")
	{
		publicTask := api.Group("")
		publicTask.Use(auth.OptionalAuthMiddleware(authHandler.GetSessionRepository()))
		{
			publicTask.GET("/tasks", taskHandler.GetTasks)
			publicTask.GET("/tasks/:id", taskHandler.GetTask)
		}

		protected := api.Group("")
		protected.Use(auth.AuthMiddleware(authHandler.GetSessionRepository()))
		{
			protected.POST("/tasks", taskHandler.CreateTask)
			protected.PUT("/tasks/:id", taskHandler.UpdateTask)
			protected.PUT("/tasks/:id/status", taskHandler.UpdateTaskStatus)

			protected.PUT("/tasks/:id/accept", taskHandler.AcceptTask)
			protected.PUT("/tasks/:id/cancel", taskHandler.CancelTask)
			protected.POST("/tasks/:id/submissions", taskHandler.SubmitTask)

			protected.PUT("/tasks/:id/approve", taskHandler.ApproveTask)
			protected.POST("/tasks/:id/claim", taskHandler.ClaimReward)

			protected.POST("/tasks/:id/onchain/funded", taskHandler.MarkTaskFunded)
			protected.POST("/tasks/:id/onchain/claimed", taskHandler.MarkTaskClaimedOnchain)

			protected.PUT("/tasks/:id/fund", taskHandler.FundTask)
		}

		api.GET("/blockchain-logs", logHandler.GetLogs)

		api.POST("/auth/wallet/siwe/message", authHandler.SIWEMessageHandler)
		api.POST("/auth/wallet/siwe/verify", authHandler.SIWEVerifyHandler)
		api.GET("/auth/me", authHandler.AuthMeHandler)
		api.POST("/auth/logout", authHandler.AuthLogoutHandler)
	}

	return r
}
