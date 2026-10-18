import { createBrowserRouter } from "react-router";
import RootLayout from "../layout/RootLayout";
import Home from "../pages/Home/Home/Home";
import AuthLayout from "../layout/AuthLayout";
import Login from "../pages/Authentication/Login/Login";
import Register from "../pages/Authentication/Register/Register";
import Coverage from "../pages/coverage/Coverage";
import SendParcel from "../pages/SendParcel/SendParcel";
import PrivateRoute from "../routes/PrivateRoutes";
import DashboardLayout from "../layout/DashboardLayout";
import MyParcels from "../pages/Dashboard/MyParcels/MyParcels";
import Payment from "../pages/Dashboard/Payment/Payment";
import PaymentHistory from "../pages/Dashboard/PaymentHistory/PaymentHistory";
import TrackParcel from "../pages/Dashboard/TrackParcel/TrackParcel";
import BeARider from "../pages/Dashboard/BeARider/BeARider";
import PendingRiders from "../pages/Dashboard/PendingRiders/PendingRiders";
import ActiveRiders from "../pages/Dashboard/ActiveRiders/ActiveRiders";
import AdminRoute from "../routes/AdminRoute";
import Forbidden from "../pages/Forbidden/Forbidden";
import AssignRider from "../pages/Dashboard/AssignRider/AssignRider";
import Parcel from "../pages/Dashboard/Parcel/Parcel";
import RiderRoute from "../routes/RiderRoute";
import PendingDeliveries from "../pages/Dashboard/PendingDeliveries/PendingDeliveries";
import CompletedDeliveries from "../pages/Dashboard/CompletedDeliveries/CompletedDeliveries";
import HubTransfers from "../pages/Dashboard/HubTransfers/HubTransfers";
import DashboardHome from "../pages/Dashboard/DashboardHome/DashboardHome";
import UpdateProfile from "../pages/Dashboard/UpdateProfile/UpdateProfile";
import ParcelTracker from "../pages/Dashboard/ParcelTracker/ParcelTracker";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: Home
      },
      {
        path: 'coverage',
        Component: Coverage,
        loader: () => fetch('./serviceCenters.json')
      },
      {
        path: 'sendParcel',
        element: <PrivateRoute><SendParcel></SendParcel></PrivateRoute>
      },
      {
        path: 'beARider',
        element: <PrivateRoute><BeARider></BeARider></PrivateRoute>
      },
      {
        path: "forbidden",
        element: <Forbidden></Forbidden>
      }
    ]
  },
  {
    path: "/",
    Component: AuthLayout,
    children: [
      {
        path: 'login',
        Component: Login
      },
      {
        path: 'register',
        Component: Register
      }
    ]
  },
  {
    path: "/dashboard",
    element: <PrivateRoute>
      <DashboardLayout></DashboardLayout>
    </PrivateRoute>,
    children: [
      {
        index: true,
        element: <DashboardHome></DashboardHome>
      },
      {
        path: 'myParcels',
        Component: MyParcels

      },
      {
        path: 'parcel/:id',
        element: <Parcel/>
      },
      {
        path: "pay/:parcelId",
        Component: Payment
      },
      {
        path: "payment-history",
        Component: PaymentHistory,
      },
      {
        path: "track",
        Component: TrackParcel,
      },
      { 
        path: "profile", 
        element: <UpdateProfile /> 
      },
      //Rider Only
      {
        path: "pending-deliveries",
        element: <RiderRoute><PendingDeliveries></PendingDeliveries></RiderRoute>
      },
      { 
        path: "completed-deliveries", 
        element: <RiderRoute><CompletedDeliveries /></RiderRoute> 
      },
      //Admin Only
      {
        path: "assign-rider",
        element: <AdminRoute><AssignRider/></AdminRoute>
      },
      { path: "hub-transfers", 
        element: <AdminRoute><HubTransfers /></AdminRoute> 
      },
      {
        path: "active-riders",
        element: <AdminRoute><ActiveRiders /></AdminRoute>
      },
      {
        path: "pending-riders", 
        element: <AdminRoute><PendingRiders /></AdminRoute>
      },
      { 
        path: "parcel-tracker", 
        element: <AdminRoute><ParcelTracker /></AdminRoute> 

      },
]
  }
]);