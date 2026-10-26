import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Image,
  Dimensions,
  Alert,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as soapClient from "./soapClient";

interface BoxDetailsItem {
  id: string;
  fxh: string;
  boxCode: string;
  qty: string;
  model: string;
  color: string;
  orderCode: string;
}

export default function InWarehouseSNBox({ navigation, route }: any) {
  const { palletCode } = route.params || {};
  const {
    gs_MESBaseURL,
    gs_factoryCodeMES,
    gs_wareCode,
    gs_wareType,
    gs_userName,
    gs_userCode,
    gs_factoryindex,
  } = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<BoxDetailsItem[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [selectedItem, setSelectedItem] = useState<BoxDetailsItem | null>(null);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const data = await soapClient.InPalletSNBox(
        gs_MESBaseURL,
        gs_factoryCodeMES || "001",
        gs_wareCode,
        palletCode
      );

      if (data && data.length > 0) {
        if (data[0].isok === "0") {
          pubfunction.ShowError(data[0].retstr || "There is no product in the Pallet!");
          setDataList([]);
          setTotalQty(0);
          return;
        }

        const productRows = data.filter((item: any) => item.boxCode || item.scanBarcodeLarge || item.SN);

        if (productRows.length > 0) {
          let total = 0;
          const mapped = productRows.map((item: any, index: number) => {
            const q = parseInt(item.qty || "0");
            total += q;
            return {
              id: index.toString(),
              fxh: item.fxh || String(index + 1),
              boxCode: item.boxCode || item.scanBarcodeLarge || "",
              qty: String(item.qty || item.boxQty || "0"),
              model: item.model || "",
              color: item.color || "",
              orderCode: item.orderCode || "",
            };
          });
          setDataList(mapped);
          setTotalQty(total);
        } else {
          pubfunction.ShowError("There is no product in the Pallet!");
          setDataList([]);
          setTotalQty(0);
        }
      } else {
        pubfunction.ShowError("There is no product in the Pallet!");
        setDataList([]);
        setTotalQty(0);
      }
    } catch (err: any) {
      pubfunction.ShowError("Fetch details failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gs_wareType !== "MainWarehouse") {
      pubfunction.ShowError("Only the main warehouse can be put in storage!");
      navigation.goBack();
      return;
    }
    fetchDetails();
  }, [palletCode]);

  const handleReturn = () => {
    navigation.goBack();
  };

  const renderRow = (item: BoxDetailsItem, index: number) => {
    const isSelected = selectedItem?.boxCode === item.boxCode;
    return (
      <TouchableOpacity
        key={item.id || index}
        activeOpacity={0.8}
        onPress={() => setSelectedItem(item)}
        style={[
          styles.tableRow,
          isSelected ? { backgroundColor: "#93C5FD" } : (index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#F1F5F9" })
        ]}
      >
        <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.boxCode}</Text>
        <Text style={[styles.cell, { width: 50 }]}>{item.qty}</Text>
        <Text style={[styles.cell, { width: 110 }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 90 }]}>{item.color}</Text>
        <Text style={[styles.cell, { width: 100 }]}>{item.orderCode}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleReturn} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>box details</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Pallet Code Box */}
        <View style={styles.totalQtyBox}>
          <Text style={styles.totalQtyLabel}>Pallet:</Text>
          <Text style={styles.totalQtyValue}>{palletCode}</Text>
        </View>

        {/* Total Qty Box */}
        <View style={styles.totalQtyBox}>
          <Text style={styles.totalQtyLabel}>Total Qty:</Text>
          <Text style={styles.totalQtyValue}>{totalQty}</Text>
        </View>

        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 50 }]}>Index</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Box Code</Text>
                <Text style={[styles.headerCell, { width: 50 }]}>Qty</Text>
                <Text style={[styles.headerCell, { width: 110 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 90 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Order</Text>
              </View>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
                {loading ? (
                  <ActivityIndicator size="large" color="#06b86c" style={{ marginTop: 40 }} />
                ) : dataList.length === 0 ? (
                  <Text style={styles.emptyText}>No boxes found on this pallet.</Text>
                ) : (
                  dataList.map((item, index) => renderRow(item, index))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnDetails]}
            onPress={() => {
              if (selectedItem) {
                navigation.navigate("InWarehouseSN", {
                  palletCode: palletCode,
                  boxCode: selectedItem.boxCode
                });
              } else {
                Alert.alert("Notice", "Please select a Box from the list first.");
              }
            }}
          >
            <Text style={styles.btnText}>SN Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const scale = (size: number) => (width / 375) * size;

const createStyles = (factoryColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: factoryColor,
    paddingHorizontal: width * 0.05,
    height: scale(56),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  returnLogo: { width: scale(23), height: scale(23), marginRight: 10, tintColor: "#FFFFFF" },
  headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
  userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
  totalQtyBox: { backgroundColor: factoryColor, padding: 12, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  totalQtyLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  totalQtyValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  content: { flex: 1, padding: 16 },
  tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 3, borderWidth: 1, borderColor: factoryColor, marginBottom: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: factoryColor, paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", alignItems: "center" },
  cell: { fontSize: 11, color: "#1E293B", textAlign: "center", fontWeight: "600" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 400 },
  footer: { flexDirection: "row", borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 },
  btn: { flex: 1, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4, elevation: 1 },
  btnPrior: { backgroundColor: '#64748B' },
  btnDetails: { backgroundColor: factoryColor },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});