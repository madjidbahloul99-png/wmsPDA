import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
    DeviceEventEmitter,
    FlatList,
    TextInput,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function ModelSelect({ navigation, route }: any) {
    const onSelect = route?.params?.onSelect;
    const global = useGlobal();
    const { gsURL, gs_userName

    } = global;
    const BASE_URL = gsURL;

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [modelList, setModelList] = useState<any[]>([]);
    const [filterText, setFilterText] = useState("");
    const [selectedModel, setSelectedModel] = useState<string | null>(null);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            if (t) setToken(t);
        };
        loadToken();
    }, []);


    const fetchModels = React.useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/Modellist`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                },
            });

            if (response.status === 401) {
                Alert.alert("Unauthorized", "Token expired or invalid.");
                return;
            }

            if (response.status === 403) {
                Alert.alert("Access Denied", "You do not have permission.");
                return;
            }

            const result = await response.json();

            if (result.message === "success" && result.data) {
                setModelList(result.data);
            }

        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    }, [BASE_URL, token]);

    useEffect(() => {
        if (token) {
            fetchModels();
        }
    }, [fetchModels, token]);



    const handleConfirm = () => {
        if (selectedModel) {
            if (onSelect) onSelect(selectedModel);
            DeviceEventEmitter.emit("ModelSelected", { model: selectedModel });
            navigation.goBack();
        } else {
            Alert.alert("Selection Required", "Please select a model first.");
        }
    };

    const renderItem = ({ item, index }: { item: any, index: number }) => (
        <TouchableOpacity
            style={[
                styles.tableRow,
                { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
                selectedModel === item.model && styles.selectedRow
            ]}
            onPress={() => setSelectedModel(item.model)}
        >
            <View style={{ width: 160 }}>
                <Text style={styles.cell}>{item.model}</Text>
            </View>
            <View style={{ width: 160 }}>
                <Text style={styles.cell}>{item.color}</Text>
            </View>
            <View style={{ width: 200 }}>
                <Text style={styles.cell}>{item.modelDesc}</Text>
            </View>
            <View style={{ width: 400 }}>
                <Text style={styles.cell}>{item.modelDesc2}</Text>
            </View>
        </TouchableOpacity>
    );

    const ListHeader = () => (
        <View style={styles.tableHeader}>
            <View style={{ width: 160 }}>
                <Text style={styles.headerCell}>Model</Text>
            </View>
            <View style={{ width: 160 }}>
                <Text style={styles.headerCell}>Color</Text>
            </View>
            <View style={{ width: 200 }}>
                <Text style={styles.headerCell}>Model Desc</Text>
            </View>
            <View style={{ width: 400 }}>
                <Text style={styles.headerCell}>Model Desc2</Text>
            </View>
        </View>
    );

    const filteredList = modelList.filter(item =>
        item.model?.toLowerCase().includes(filterText.toLowerCase()) ||
        item.modelDesc?.toLowerCase().includes(filterText.toLowerCase()) ||
        item.modelDesc2?.toLowerCase().includes(filterText.toLowerCase()) ||
        item.color?.toLowerCase().includes(filterText.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                        <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Select Model</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.summaryInfo}>
                    <Text style={styles.labelText}>Total Qty</Text>
                    <Text style={styles.totalQtyText}>{filteredList.length}</Text>
                </View>

                <View style={styles.filterSection}>
                    <TextInput
                        style={styles.filterInput}
                        placeholder="Search models..."
                        value={filterText}
                        onChangeText={setFilterText}
                        placeholderTextColor="#94A3B8"
                    />
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={{ flex: 1 }}>
                            {loading ? (
                                <View style={{ flex: 1, width: 520, justifyContent: 'center' }}>
                                    <ActivityIndicator size="large" color="#0052cc" />
                                </View>
                            ) : (
                                <FlatList
                                    data={filteredList}
                                    renderItem={({ item, index }) => renderItem({ item, index })}
                                    keyExtractor={(item, index) => index.toString()}
                                    ListHeaderComponent={ListHeader}
                                    stickyHeaderIndices={[0]}
                                    ListEmptyComponent={
                                        <Text style={[styles.emptyText, { width: 520 }]}>No models found</Text>
                                    }
                                    showsVerticalScrollIndicator={true}
                                />
                            )}
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.confirmBtn, !selectedModel && styles.disabledBtn]}
                        onPress={handleConfirm}
                        disabled={!selectedModel || loading}
                    >
                        <Text style={styles.confirmBtnText}>Confirm</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { backgroundColor: "#0052cc", paddingHorizontal: width * 0.05, height: scale(56), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: { color: "#FFFFFF", fontSize: scale(16), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 16 },
    summaryInfo: {
        marginBottom: 12,
        backgroundColor: '#0052cc',
        padding: 10,
        borderRadius: 8,

        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },

    labelText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700'
    },

    totalQtyText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900'
    },
    filterSection: { marginBottom: 12 },
    filterInput: { backgroundColor: '#FFF', height: 40, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#0052cc', color: '#1E293B', fontWeight: '600' },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 4, borderWidth: 1, borderColor: "#E2E8F0" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 12 },
    headerCell: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 13, color: "#334155", textAlign: "center", fontWeight: "600" },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic" },
    selectedRow: { backgroundColor: '#ffc3c3ff' },
    footer: { marginTop: 16 },
    confirmBtn: { backgroundColor: "#0052cc", padding: 8, borderRadius: 12, alignItems: "center", elevation: 2, height: 40 },
    confirmBtnText: { color: "#FFF", fontWeight: "900", fontSize: 14 },
    disabledBtn: { backgroundColor: "#0052cc" },
});
