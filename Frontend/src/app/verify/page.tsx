import VerifyOtp from "@/components/VerifyOtp";
import { Suspense } from "react";

const VerifyPage = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-white">Loading...</p></div>}>
      <VerifyOtp />
    </Suspense>
  );
};

export default VerifyPage;
