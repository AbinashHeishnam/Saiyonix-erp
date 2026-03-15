import { Router } from "express";

import { sendOtpController, verifyOtpController } from "./otp.controller";
import { otpLimiter } from "../../middleware/rateLimiter.middleware";
import { validate } from "../../middleware/validate.middleware";
import { sendOtpSchema, verifyOtpSchema } from "./otp.validation";

const otpRouter = Router();

otpRouter.post("/send", otpLimiter, validate(sendOtpSchema), sendOtpController);
otpRouter.post("/verify", otpLimiter, validate(verifyOtpSchema), verifyOtpController);

export default otpRouter;
