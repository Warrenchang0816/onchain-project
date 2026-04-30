package bootstrap

import (
	"time"

	"go-service/internal/db/repository"
	agentmod "go-service/internal/modules/agent"
	authmod "go-service/internal/modules/auth"
	credentialmod "go-service/internal/modules/credential"
	listingmod "go-service/internal/modules/listing"
	logsmod "go-service/internal/modules/logs"
	onboardingmod "go-service/internal/modules/onboarding"
	propertymod "go-service/internal/modules/property"
	tenantmod "go-service/internal/modules/tenant"
	usermod "go-service/internal/modules/user"
	platformauth "go-service/internal/platform/auth"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(
	listingHandler *listingmod.Handler,
	logHandler *logsmod.Handler,
	authHandler *authmod.Handler,
	loginHandler *authmod.LoginHandler,
	resetPasswordHandler *authmod.ResetPasswordHandler,
	userHandler *usermod.Handler,
	adminHandler *usermod.AdminHandler,
	onboardingHandler *onboardingmod.Handler,
	credentialHandler *credentialmod.Handler,
	credentialAdminHandler *credentialmod.AdminHandler,
	sessionRepo *repository.SessionRepository,
	agentHandler *agentmod.Handler,
	tenantHandler *tenantmod.Handler,
	propertyHandler *propertymod.Handler,
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
		// ── Public routes (optional auth for isOwner flag) ────────
		publicRoutes := api.Group("")
		publicRoutes.Use(platformauth.OptionalAuthMiddleware(sessionRepo))
		{
			publicRoutes.GET("/listings", listingHandler.ListListings)
			publicRoutes.GET("/listings/:id", listingHandler.GetListing)
			publicRoutes.GET("/kyc/me", userHandler.GetKYCStatus)
		}

		// ── Protected routes (auth required) ─────────────────────
		protected := api.Group("")
		protected.Use(platformauth.AuthMiddleware(sessionRepo))
		{
			// Listing management (owner)
			protected.GET("/listings/mine", listingHandler.ListMyListings)
			protected.POST("/listings", listingHandler.CreateListing)
			protected.PUT("/listings/:id", listingHandler.UpdateListing)
			protected.PUT("/listings/:id/intent", listingHandler.SetListingIntent)
			protected.PUT("/listings/:id/publish", listingHandler.PublishListing)
			protected.PUT("/listings/:id/remove", listingHandler.RemoveListing)
			protected.PUT("/listings/:id/close", listingHandler.CloseListing)
			protected.PUT("/listings/:id/negotiate", listingHandler.LockNegotiation)
			protected.PUT("/listings/:id/unlock", listingHandler.UnlockNegotiation)

			// Property management (owner)
			protected.GET("/properties/mine", propertyHandler.ListMyProperties)
			protected.GET("/properties/:id", propertyHandler.GetProperty)
			protected.PUT("/properties/:id/disclosure", propertyHandler.UpdateDisclosure)
			protected.POST("/properties/:id/disclosure/confirm", propertyHandler.ConfirmDisclosure)

			// Appointment management
			protected.POST("/listings/:id/appointments", listingHandler.BookAppointment)
			protected.PUT("/listings/:id/appointments/:appt_id/confirm", listingHandler.ConfirmAppointment)
			protected.PUT("/listings/:id/appointments/:appt_id/status", listingHandler.UpdateAppointmentStatus)
			protected.PUT("/listings/:id/appointments/:appt_id/cancel", listingHandler.CancelAppointment)

			// KYC submission
			protected.POST("/kyc/submissions", userHandler.CreateKYCSubmission)
			protected.POST("/kyc/submissions/:id/documents", userHandler.UploadKYCSubmissionDocuments)
			protected.POST("/kyc/submissions/:id/analyze", userHandler.AnalyzeKYCSubmission)
			protected.GET("/kyc/submissions/:id", userHandler.GetKYCSubmission)

			// User profile
			protected.GET("/user/profile", userHandler.GetProfile)
			protected.POST("/user/profile/email/otp", userHandler.RequestEmailChangeOTP)
			protected.PUT("/user/profile/email", userHandler.VerifyEmailChange)
			protected.POST("/user/profile/phone/otp", userHandler.RequestPhoneChangeOTP)
			protected.PUT("/user/profile/phone", userHandler.VerifyPhoneChange)
			protected.POST("/user/profile/mailing-address/otp", userHandler.RequestMailingAddressOTP)
			protected.PUT("/user/profile/mailing-address", userHandler.UpdateMailingAddress)

			// Admin
			protected.GET("/admin/kyc/pending", adminHandler.ListPendingManual)
			protected.PUT("/admin/kyc/:id/review", adminHandler.ReviewSubmission)
			protected.GET("/admin/credentials/pending", credentialAdminHandler.ListPendingManual)
			protected.PUT("/admin/credentials/:id/review", credentialAdminHandler.ReviewSubmission)

			// Role credentials
			protected.GET("/credentials/me", credentialHandler.GetMyCredentials)
			protected.POST("/credentials/:type/submissions", credentialHandler.CreateSubmission)
			protected.GET("/credentials/:type/submissions/latest", credentialHandler.GetLatestSubmission)
			protected.POST("/credentials/:type/submissions/:id/files", credentialHandler.UploadFiles)
			protected.POST("/credentials/:type/submissions/:id/analyze", credentialHandler.AnalyzeSubmission)
			protected.POST("/credentials/:type/submissions/:id/manual", credentialHandler.RequestManualReview)
			protected.POST("/credentials/:type/submissions/:id/activate", credentialHandler.ActivateSubmission)
			protected.POST("/credentials/:type/submissions/:id/stop", credentialHandler.StopSubmission)
			protected.GET("/credentials/:type/submissions/:id/files/main", credentialHandler.GetMainFile)
			protected.GET("/credentials/:type/submissions/:id/files/support", credentialHandler.GetSupportFile)

			// Agent private profile
			protected.GET("/agents/me/profile", agentHandler.GetMyProfile)
			protected.PUT("/agents/me/profile", agentHandler.UpsertMyProfile)

			// Tenant profile and requirements (tenant-only)
			protected.GET("/tenant/profile", tenantHandler.GetMyProfile)
			protected.PUT("/tenant/profile", tenantHandler.UpsertMyProfile)
			protected.POST("/tenant/profile/documents", tenantHandler.UploadMyDocument)
			protected.GET("/tenant/requirements/mine", tenantHandler.ListMyRequirements)
			protected.POST("/tenant/requirements", tenantHandler.CreateRequirement)
			protected.PUT("/tenant/requirements/:id", tenantHandler.UpdateRequirement)
			protected.PUT("/tenant/requirements/:id/status", tenantHandler.UpdateRequirementStatus)
			protected.GET("/requirements", tenantHandler.ListVisibleRequirements)
			protected.GET("/requirements/:id", tenantHandler.GetVisibleRequirement)
		}

		// ── Blockchain logs (public) ──────────────────────────────
		api.GET("/blockchain-logs", logHandler.GetLogs)

		// ── Agent directory (public) ─────────────────────────────
		api.GET("/agents", agentHandler.ListAgents)
		api.GET("/agents/:wallet", agentHandler.GetAgentByWallet)

		// ── Auth ──────────────────────────────────────────────────
		api.POST("/auth/wallet/siwe/message", authHandler.SIWEMessageHandler)
		api.POST("/auth/wallet/siwe/verify", authHandler.SIWEVerifyHandler)
		api.GET("/auth/me", authHandler.AuthMeHandler)
		api.POST("/auth/logout", authHandler.AuthLogoutHandler)
		api.POST("/auth/login", loginHandler.Login)
		api.POST("/auth/password/set", loginHandler.SetPassword)
		api.POST("/auth/reset-password/request-otp", resetPasswordHandler.RequestOTP)
		api.POST("/auth/reset-password/set-password", resetPasswordHandler.SetPassword)

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
