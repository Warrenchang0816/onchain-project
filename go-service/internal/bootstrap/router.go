package bootstrap

import (
	"time"

	"go-service/internal/db/repository"
	authmod "go-service/internal/modules/auth"
	onboardingmod "go-service/internal/modules/onboarding"
	"go-service/internal/modules/task"
	usermod "go-service/internal/modules/user"
	platformauth "go-service/internal/platform/auth"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(
	taskHandler *task.TaskHandler,
	logHandler *task.BlockchainLogHandler,
	authHandler *authmod.Handler,
	loginHandler *authmod.LoginHandler,
	userHandler *usermod.Handler,
	adminHandler *usermod.AdminHandler,
	onboardingHandler *onboardingmod.Handler,
	sessionRepo *repository.SessionRepository,
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
		publicTask.Use(platformauth.OptionalAuthMiddleware(sessionRepo))
		{
			publicTask.GET("/tasks", taskHandler.GetTasks)
			publicTask.GET("/tasks/:id", taskHandler.GetTask)
			publicTask.GET("/kyc/me", userHandler.GetKYCStatus)
		}

		protected := api.Group("")
		protected.Use(platformauth.AuthMiddleware(sessionRepo))
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

			protected.POST("/kyc/submissions", userHandler.CreateKYCSubmission)
			protected.POST("/kyc/submissions/:id/documents", userHandler.UploadKYCSubmissionDocuments)
			protected.POST("/kyc/submissions/:id/analyze", userHandler.AnalyzeKYCSubmission)
			protected.GET("/kyc/submissions/:id", userHandler.GetKYCSubmission)

			protected.GET("/user/profile", userHandler.GetProfile)
			protected.POST("/user/profile/email/otp", userHandler.RequestEmailChangeOTP)
			protected.PUT("/user/profile/email", userHandler.VerifyEmailChange)
			protected.POST("/user/profile/phone/otp", userHandler.RequestPhoneChangeOTP)
			protected.PUT("/user/profile/phone", userHandler.VerifyPhoneChange)
			protected.POST("/user/profile/mailing-address/otp", userHandler.RequestMailingAddressOTP)
			protected.PUT("/user/profile/mailing-address", userHandler.UpdateMailingAddress)

			protected.GET("/admin/kyc/pending", adminHandler.ListPendingManual)
			protected.PUT("/admin/kyc/:id/review", adminHandler.ReviewSubmission)
		}

		api.GET("/blockchain-logs", logHandler.GetLogs)

		api.POST("/auth/wallet/siwe/message", authHandler.SIWEMessageHandler)
		api.POST("/auth/wallet/siwe/verify", authHandler.SIWEVerifyHandler)
		api.GET("/auth/me", authHandler.AuthMeHandler)
		api.POST("/auth/logout", authHandler.AuthLogoutHandler)

		// ── Email + password login ────────────────────────────────
		api.POST("/auth/login", loginHandler.Login)
		api.POST("/auth/password/set", loginHandler.SetPassword)

		// ── Wallet change (requires active session) ───────────────
		authProtected := api.Group("/auth")
		authProtected.Use(platformauth.AuthMiddleware(sessionRepo))
		{
			authProtected.POST("/wallet/change", loginHandler.ChangeWallet)
		}

		// ── KYC-first onboarding (no auth required) ──────────────
		ob := api.Group("/onboard")
		{
			ob.POST("/email/request-otp", onboardingHandler.RequestEmailOTP)
			ob.POST("/email/verify-otp", onboardingHandler.VerifyEmailOTP)
			ob.POST("/session/restart", onboardingHandler.RestartSession)
			ob.POST("/phone/request-otp", onboardingHandler.RequestPhoneOTP)
			ob.POST("/phone/verify-otp", onboardingHandler.VerifyPhoneOTP)
			ob.POST("/kyc/upload", onboardingHandler.UploadKYCDocuments)
			ob.POST("/kyc/confirm", onboardingHandler.ConfirmKYCData)
			ob.POST("/wallet/message", onboardingHandler.WalletMessage)
			ob.POST("/wallet/bind", onboardingHandler.BindWallet)
		}
	}

	return r
}
