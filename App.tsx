import React from "react";
import { GlobalStrProvider } from "./GlobalStrContext";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Login from "./src/Login";
import SplashScreen from "./src/SplashScreen";
import Menu from "./src/Menu";

//InWharHouse
import InWarehouse from "./src/InWarehouse/InWarehouse";
import InWarehouseConfirmBox from "./src/InWarehouse/InWarehouseConfirmBox";
import InWarehouseSNBox from "./src/InWarehouse/InWarehouseSNBox";
import InWarehouseSNConfirm from "./src/InWarehouse/InWarehouseSNConfirm";
import InWarehouseSN from "./src/InWarehouse/InWarehouseSN";

//InWareHouseChina
import InWareHouseChina from "./src/inWareHouseChina/InWareHouseChina";
import InWareHouseChinaSNConfirmBox from "./src/inWareHouseChina/InWareHouseChinaSNConfirmBox";
import InWareHouseChinaSNBox from "./src/inWareHouseChina/InWareHouseChinaSNBox";


//DeliverySAP
import DeliverySAP from "./src/Delivery/DeliverySAP";
import DeliverySNConfirm from "./src/Delivery/DeliverySNConfirm";
import DeliverySNBox from "./src/Delivery/DeliverySNBox";
import DeliverySN from "./src/Delivery/DeliverySN";

//AllocateIn
import AllocateInNONewSap from "./src/AllocateIN/AllocateInNONewSap";
import AllocateInNewSap from "./src/AllocateIN/AllocateInNewSap";
import AllocateInSNConfirmBoxNew from "./src/AllocateIN/AllocateInSNConfirmBoxNew";



//AllocateoutSAP
import AllocateOutNONewSap from "./src/Allocateout/AllocateOutNONewSap";
import AllocateOutNewSap from "./src/Allocateout/AllocateOutNewSap";
import AllocateOutSNConfirmBoxNew from "./src/Allocateout/AllocateOutSNConfirmBoxNew";

//AllocateRejectIn
import AllocateRejectInOldWMS from "./src/AllocateRejectIn/AllocateRejectInOldWMS";
import AllocateRejectInSNConfirmOldWMS from "./src/AllocateRejectIn/AllocateRejectInSNConfirmOldWMS";

//PalletSearch
import PalletSearch from "./src/PalletSearch/PalletSearch";


//PalletnotIn
import PalletNotIn from "./src/PalletNotIn/PalletNotIn";
import PalletNotInBox from "./src/PalletNotIn/PalletNotInBox";
import PalletNotInSN from "./src/PalletNotIn/PalletNotInSN";

//DFCInventory
import DFCInventory from "./src/InventoryDFC/DFCInventory";
import DFCInventoryQty from "./src/InventoryDFC/DFCInventoryQty";
import DFCInventoryArea from "./src/InventoryDFC/DFCInventoryArea";

//DFCInventory
import GDSInventory from "./src/InventoryGDS/GDSInventory";
import GDSInventoryNew from "./src/InventoryGDS/GDSInventoryNew";
import GDSInventorySNConfirmBoxNew from "./src/InventoryGDS/GDSInventorySNConfirmBoxNew";


//DeliveryReturn
import DeliveryReturnNONewSap from "./src/DeliveryReturn/DeliveryReturnNONewSap";
import DeliveryReturnNewSap from "./src/DeliveryReturn/DeliveryReturnNewSap";
import DeliveryReturnSNConfirmBoxNew from "./src/DeliveryReturn/DeliveryReturnSNConfirmBoxNew";




//DistributorReturn
import DistributorReturnNONewSap from "./src/DistributorReturn/DistributorReturnNONewSap";
import DistributorReturnNewSap from "./src/DistributorReturn/DistributorReturnNewSap";
import DistributorReturnSNConfirmBoxNew from "./src/DistributorReturn/DistributorReturnSNConfirmBoxNew";









const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GlobalStrProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="SplashScreen"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="SplashScreen" component={SplashScreen} />
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Menu" component={Menu} />



          <Stack.Screen name="InWarehouse" component={InWarehouse} />
          <Stack.Screen name="InWarehouseConfirmBox" component={InWarehouseConfirmBox} />
          <Stack.Screen name="InWarehouseSNBox" component={InWarehouseSNBox} />
          <Stack.Screen name="InWarehouseSNConfirm" component={InWarehouseSNConfirm} />
          <Stack.Screen name="InWarehouseSN" component={InWarehouseSN} />


          <Stack.Screen name="InWareHouseChina" component={InWareHouseChina} />
          <Stack.Screen name="InWareHouseChinaSNConfirmBox" component={InWareHouseChinaSNConfirmBox} />
          <Stack.Screen name="InWareHouseChinaSNBox" component={InWareHouseChinaSNBox} />


          <Stack.Screen name="DeliverySAP" component={DeliverySAP} />
          <Stack.Screen name="DeliverySNConfirm" component={DeliverySNConfirm} />
          <Stack.Screen name="DeliverySNBox" component={DeliverySNBox} />
          <Stack.Screen name="DeliverySN" component={DeliverySN} />

          <Stack.Screen name="DeliveryReturnNONewSap" component={DeliveryReturnNONewSap} />
          <Stack.Screen name="DeliveryReturnNewSap" component={DeliveryReturnNewSap} />
          <Stack.Screen name="DeliveryReturnSNConfirmBoxNew" component={DeliveryReturnSNConfirmBoxNew} />

          <Stack.Screen name="AllocateOutNONewSap" component={AllocateOutNONewSap} />
          <Stack.Screen name="AllocateOutNewSap" component={AllocateOutNewSap} />
          <Stack.Screen name="AllocateOutSNConfirmBoxNew" component={AllocateOutSNConfirmBoxNew} />

          <Stack.Screen name="AllocateInNONewSap" component={AllocateInNONewSap} />
          <Stack.Screen name="AllocateInNewSap" component={AllocateInNewSap} />
          <Stack.Screen name="AllocateInSNConfirmBoxNew" component={AllocateInSNConfirmBoxNew} />


          <Stack.Screen name="AllocateRejectInOldWMS" component={AllocateRejectInOldWMS} />
          <Stack.Screen name="AllocateRejectInSNConfirmOldWMS" component={AllocateRejectInSNConfirmOldWMS} />


          <Stack.Screen name="PalletSearch" component={PalletSearch} />


          <Stack.Screen name="PalletNotIn" component={PalletNotIn} />
          <Stack.Screen name="PalletNotInBox" component={PalletNotInBox} />
          <Stack.Screen name="PalletNotInSN" component={PalletNotInSN} />




          <Stack.Screen name="DFCInventory" component={DFCInventory} />
          <Stack.Screen name="DFCInventoryQty" component={DFCInventoryQty} />
          <Stack.Screen name="DFCInventoryArea" component={DFCInventoryArea} />

          <Stack.Screen name="GDSInventory" component={GDSInventory} />
          <Stack.Screen name="GDSInventoryNew" component={GDSInventoryNew} />
          <Stack.Screen name="GDSInventorySNConfirmBoxNew" component={GDSInventorySNConfirmBoxNew} />

          <Stack.Screen name="DistributorReturnNONewSap" component={DistributorReturnNONewSap} />
          <Stack.Screen name="DistributorReturnNewSap" component={DistributorReturnNewSap} />
          <Stack.Screen name="DistributorReturnSNConfirmBoxNew" component={DistributorReturnSNConfirmBoxNew} />





        </Stack.Navigator>
      </NavigationContainer>
    </GlobalStrProvider>
  );
}
