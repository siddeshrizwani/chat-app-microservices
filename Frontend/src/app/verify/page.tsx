import Loading from "@/components/Loading";
import VerifyOtp from "@/components/VerifyOtp";
import { Suspense } from "react";

// VerifyOtp reads the email from the url using useSearchParams,
// so next requires it to be wrapped in Suspense
const VerifyPage = () => {
  return (
    <Suspense fallback={<Loading />}>
      <VerifyOtp />
    </Suspense>
  );
};

export default VerifyPage;
