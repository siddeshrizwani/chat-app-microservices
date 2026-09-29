"use client";
import { useAppData, user_service } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import toast from "react-hot-toast";
import Loading from "@/components/Loading";
import { ArrowLeft, Save, User, UserCircle } from "lucide-react";

const ProfilePage = () => {
  const { user, isAuth, loading, setUser } = useAppData();

  // toggles between the read only row and the edit form
  const [isEdit, setIsEdit] = useState(false);
  const [name, setName] = useState<string | undefined>("");

  const router = useRouter();

  // seed the input with the current name every time edit mode opens,
  // so cancelling and reopening never shows a stale value
  const editHandler = () => {
    setIsEdit(!isEdit);
    setName(user?.name);
  };

  const submitHandler = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = Cookies.get("token");
    try {
      // the route is registered as PUT on the user service
      const { data } = await axios.put(
        `${user_service}/api/v1/update/user`,
        { name },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // the name is baked into the jwt, so the backend issues a fresh token
      Cookies.set("token", data.token, {
        expires: 15,
        secure: false,
        path: "/",
      });

      toast.success(data.message);
      // update the context so the sidebar and chat header pick up the new name
      setUser(data.user);
      setIsEdit(false);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to update profile");
      } else {
        toast.error("Failed to update profile");
      }
    }
  };

  // same auth guard as the chat page
  useEffect(() => {
    if (!isAuth && !loading) {
      router.push("/login");
    }
  }, [isAuth, router, loading]);

  if (loading) return <Loading />;
  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/chat")}
            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700"
          >
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
            <p className="text-gray-400 mt-1">
              Manage your account information
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg">
          {/* banner with the avatar and current name */}
          <div className="bg-gray-700 p-8 border-b border-gray-600">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gray-600 flex items-center justify-center">
                  <UserCircle className="w-12 h-12 text-gray-300" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-gray-800"></div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {user?.name || "User"}
                </h2>
                <p className="text-gray-300 text-sm">Active now</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Display Name
                </label>

                {isEdit ? (
                  <form onSubmit={submitHandler} className="space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                      />
                      <User className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                      >
                        <Save className="w-4 h-4" /> Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={editHandler}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600">
                    <span className="text-white font-medium text-lg">
                      {user?.name || "Not set"}
                    </span>
                    <button
                      onClick={editHandler}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
